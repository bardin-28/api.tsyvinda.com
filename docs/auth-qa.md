# Auth — Manual QA Guide

How to verify the `/auth/*` flow end-to-end against a local dev stack and against the live droplet, primarily via Swagger UI with curl fallbacks. Use after deploying or changing anything under `src/modules/auth/`.

---

## Table of contents

- [What you are testing](#what-you-are-testing)
- [Local dev — setup](#local-dev--setup)
- [Local dev — happy-path walkthrough (Swagger)](#local-dev--happy-path-walkthrough-swagger)
- [Local dev — happy-path walkthrough (curl)](#local-dev--happy-path-walkthrough-curl)
- [Local dev — verification queries](#local-dev--verification-queries)
- [Local dev — failure cases to verify](#local-dev--failure-cases-to-verify)
- [Live server — setup](#live-server--setup)
- [Live server — walkthrough](#live-server--walkthrough)
- [Live server — verification & rollback](#live-server--verification--rollback)
- [Reading the verification token in dev/test mode](#reading-the-verification-token-in-devtest-mode)
- [Common pitfalls](#common-pitfalls)

---

## What you are testing

Six endpoints — happy path + the obvious failure modes:

| Method | Path                  | Auth            | Success | Common failures                                                |
| ------ | --------------------- | --------------- | ------- | -------------------------------------------------------------- |
| POST   | `/auth/register`      | —               | 201     | 400 validation, 409 email taken                                |
| POST   | `/auth/confirm-email` | —               | 200     | 400 invalid/expired/consumed token                             |
| POST   | `/auth/login`         | —               | 200     | 400 validation, 401 invalid creds, 403 email-not-verified      |
| POST   | `/auth/refresh`       | `refresh` cookie | 200    | 401 missing/invalid/expired/reused refresh                     |
| POST   | `/auth/logout`        | `refresh` cookie | 204    | —                                                              |
| GET    | `/auth/me`            | `access` cookie  | 200    | 401 missing/invalid/expired access token                       |

State you should see in the DB after a full happy path:

- `users` — one row with `email_verified = true`, `password_hash` non-null.
- `user_identities` — one row, `provider = 'local'`.
- `email_verifications` — one row with `consumed_at` non-null.
- `refresh_tokens` — one active row after login (or one revoked + one active after a `/auth/refresh` rotation).

---

## Local dev — setup

### 1. Env

Copy `.env.example` → `.env.local` and fill in the auth-related vars:

```env
JWT_ACCESS_SECRET=<paste 32+ char random — see below>
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
BCRYPT_COST=12
RESEND_API_KEY=test
EMAIL_FROM="Blog <noreply@tsyvinda.local>"
# COOKIE_DOMAIN=.tsyvinda.local
FRONTEND_HOST=https://tsyvinda.local
```

Generate `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

When `RESEND_API_KEY=test` the app **does not call Resend** — it just logs the verification URL at `debug` level. You read the token from the logs (see [Reading the verification token in dev/test mode](#reading-the-verification-token-in-devtest-mode)).

### 2. /etc/hosts (for HTTPS via nginx-proxy)

```
127.0.0.1 api.tsyvinda.local
```

### 3. TLS cert

```bash
npm run cert
```

### 4. Boot the stack

```bash
docker compose up --build
```

Wait for `Database connected` + `Redis connected` + `Server listening` in the app logs. On first boot `synchronize: true` (dev only) creates the four auth tables.

### 5. Open Swagger UI

`https://api.tsyvinda.local/docs` — you should see the `Auth` tag with six routes.

---

## Local dev — happy-path walkthrough (Swagger)

1. **Register**
   - Expand `POST /auth/register` → **Try it out**.
   - Body:
     ```json
     {
       "firstName": "Vlad",
       "lastName": "T",
       "email": "qa+local@tsyvinda.com",
       "password": "Secret123",
       "confirmPassword": "Secret123"
     }
     ```
   - Expected: `201 Created`, `{ "message": "Verification email sent. ..." }`.
   - In the app logs find a line like:
     ```
     [debug] email:verify (mocked) { to: 'qa+local@tsyvinda.com', url: 'https://tsyvinda.local/registration?token=...' }
     ```
   - Copy the `token` query-string value.

2. **Confirm email**
   - Expand `POST /auth/confirm-email` → body:
     ```json
     { "token": "<paste-token-here>" }
     ```
   - Expected: `200 OK`, `{ "message": "Email confirmed." }`.

3. **Login**
   - Expand `POST /auth/login` → body:
     ```json
     { "email": "qa+local@tsyvinda.com", "password": "Secret123" }
     ```
   - Expected: `200 OK`, body `{ user: {...} }` (no `accessToken` in body — it's in a cookie).
   - Verify cookies in **DevTools → Application → Cookies → https://api.tsyvinda.local**:
     - `access` — HttpOnly, Secure, SameSite=Lax, Path=`/`
     - `refresh` — HttpOnly, Secure, SameSite=Lax, Path=`/auth`
   - (Swagger UI cannot show `Set-Cookie` in its response panel — that header is hidden from JS by browsers.)

4. **/auth/me**
   - Expand `GET /auth/me` → **Try it out** → Execute. No Authorize step needed — the `access` cookie is sent automatically because Swagger UI and the API are same-origin.
   - Expected: `200 OK` with `{ id, firstName, lastName, email, profileImageUrl, emailVerified: true, createdAt }`.

5. **/auth/refresh**
   - Expand `POST /auth/refresh` → Execute. Browser sends `refresh` cookie automatically (it's scoped to `/auth`).
   - Expected: `200 OK` + body `{ user }`. Both `access` and `refresh` cookies in DevTools have new values now.

6. **/auth/logout**
   - Expand `POST /auth/logout` → Execute.
   - Expected: `204 No Content`. In DevTools both cookies should be gone (or showing expired).
   - Re-running `/auth/refresh` or `/auth/me` now returns `401 UNAUTHENTICATED`.

> **Swagger gotcha**: cookies are stored per-origin in the browser. As long as you stay on `https://api.tsyvinda.local/docs`, the browser handles everything. If you open Swagger via a different host (e.g. `localhost:3000/docs` bypassing nginx-proxy), the cookies won't match and `/auth/me` returns 401.

---

## Local dev — happy-path walkthrough (curl)

Use this when Swagger UI is unavailable or you want a scripted re-run.

```bash
HOST=https://api.tsyvinda.local

# 1. Register
curl -ks -X POST $HOST/auth/register \
  -H 'content-type: application/json' \
  -d '{"firstName":"Vlad","lastName":"T","email":"qa+local@tsyvinda.com","password":"Secret123","confirmPassword":"Secret123"}'

# 2. Confirm — get TOKEN from app logs first
TOKEN=<paste-from-logs>
curl -ks -X POST $HOST/auth/confirm-email \
  -H 'content-type: application/json' \
  -d "{\"token\":\"$TOKEN\"}"

# 3. Login — write access + refresh cookies to cookies.txt
curl -ks -c cookies.txt -X POST $HOST/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"qa+local@tsyvinda.com","password":"Secret123"}'

# 4. Profile — sends the access cookie automatically via -b
curl -ks -b cookies.txt $HOST/auth/me

# 5. Refresh (rotates both cookies)
curl -ks -b cookies.txt -c cookies.txt -X POST $HOST/auth/refresh

# 6. Logout (clears both cookies)
curl -ks -b cookies.txt -c cookies.txt -X POST $HOST/auth/logout -o /dev/null -w '%{http_code}\n'
# expected: 204
```

`-k` skips TLS verification (mkcert root may not be in curl's CA store on every host).

---

## Local dev — verification queries

Open psql against the dev DB (host port 5432):

```bash
docker compose exec postgres psql -U postgres -d app
```

```sql
-- After register
SELECT id, email, email_verified, password_hash IS NOT NULL AS has_pw
FROM users WHERE email = 'qa+local@tsyvinda.com';

SELECT provider, provider_user_id FROM user_identities
WHERE user_id = (SELECT id FROM users WHERE email = 'qa+local@tsyvinda.com');

SELECT token_hash, expires_at, consumed_at FROM email_verifications
WHERE user_id = (SELECT id FROM users WHERE email = 'qa+local@tsyvinda.com');

-- After confirm
SELECT email_verified FROM users WHERE email = 'qa+local@tsyvinda.com';  -- t

-- After login
SELECT id, expires_at, revoked_at, replaced_by_id, user_agent, ip
FROM refresh_tokens
WHERE user_id = (SELECT id FROM users WHERE email = 'qa+local@tsyvinda.com')
ORDER BY created_at DESC;

-- After refresh rotation
-- Expect: 2 rows. Old one has revoked_at and replaced_by_id pointing to the new row.

-- After logout
-- Expect: latest row has revoked_at set.
```

---

## Local dev — failure cases to verify

Run each via Swagger or curl. All should be the listed status code with a structured `{ error: { code, message, requestId } }` body.

| What                                                | Expected                          |
| --------------------------------------------------- | --------------------------------- |
| Register with `password=short`                      | `400` `VALIDATION_FAILED`         |
| Register with `password !== confirmPassword`        | `400` `VALIDATION_FAILED`         |
| Register with malformed email                       | `400` `VALIDATION_FAILED`         |
| Register twice with the same email                  | `409` `EMAIL_TAKEN`               |
| `confirm-email` with junk token (32+ chars)         | `400` `INVALID_TOKEN`             |
| `confirm-email` with the same valid token twice     | `200` first, `200` second within 1h (idempotent), `400` after |
| Login with wrong password                           | `401` `INVALID_CREDENTIALS`       |
| Login with unknown email                            | `401` `INVALID_CREDENTIALS` (enumeration-safe) |
| Login before email confirmation                     | `403` `EMAIL_NOT_VERIFIED`        |
| `/auth/me` with no `access` cookie                  | `401` `UNAUTHENTICATED`           |
| `/auth/me` with `Cookie: access=junk`               | `401` `INVALID_TOKEN`             |
| `/auth/refresh` with no `refresh` cookie            | `401` `UNAUTHENTICATED`           |
| `/auth/refresh` twice with the same old refresh     | `401` `REFRESH_REUSE` (chain revoked) |
| 11 rapid register calls in <60s from same IP        | `429` on the 11th                  |
| 11 rapid login calls in <60s from same IP           | `429` on the 11th                  |

After a `REFRESH_REUSE`, all of that user's refresh rows should have `revoked_at` set — verify with the SQL query above.

---

## Live server — setup

### 1. Env on the droplet

`~/app/.env` on the droplet must include:

```env
NODE_ENV=production
BACKEND_HOST=api.tsyvinda.com
FRONTEND_HOST=https://tsyvinda.com
COOKIE_DOMAIN=.tsyvinda.com

JWT_ACCESS_SECRET=<32+ char random — DIFFERENT from dev>
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
BCRYPT_COST=12

RESEND_API_KEY=<real Resend key from dashboard>
EMAIL_FROM="Blog <noreply@tsyvinda.com>"
```

**`EMAIL_FROM` requirements**: the `from` domain must be **verified** in the Resend dashboard with the right DNS records. Until verified, Resend rejects sends with `403`.

### 2. Deploy

```bash
ssh deploy@<droplet-ip>
cd ~/app
git pull
docker compose -f docker-compose.prod.yml up -d --build app
docker compose -f docker-compose.prod.yml logs -f app
```

Wait for `Database connected` + `Server listening`. `synchronize: true` is **off** in prod — schema must come from a migration. If the four auth tables don't exist yet, run the migration (or, as a one-time fallback, manually flip `NODE_ENV=development` momentarily — **not recommended**; use the migration instead).

### 3. Verify health + Swagger

```bash
curl -s https://api.tsyvinda.com/health
# {"status":"ok","db":true,"redis":true}
```

Open `https://api.tsyvinda.com/docs`. Confirm the six `/auth/*` routes appear.

---

## Live server — walkthrough

Same flow as local, but the verification email now arrives in a real inbox.

1. **Register**: in Swagger, use a real address you control (yours or a `qa+...@your-domain.com` alias). Expected `201`.
2. **Inbox check**: open the email titled "Confirm your email" from the address in `EMAIL_FROM`. The link is `https://tsyvinda.com/registration?token=...`.
3. **Extract token**: copy the `token` query parameter from that URL (the FE app reads it from the URL and POSTs it to `/auth/confirm-email`).
4. **Confirm email** in Swagger using the token. Expected `200`.
5. **Login** with the same credentials. Expected `200` + `Set-Cookie rt=...; Domain=.tsyvinda.com; Path=/auth; HttpOnly; Secure; SameSite=Lax`. Inspect with browser DevTools → Application → Cookies → `api.tsyvinda.com`.
6. **/auth/me** in Swagger (after Authorize). Expected `200` with your profile.
7. **/auth/refresh**, **/auth/logout** — same as local.

### Cookie test from outside Swagger

```bash
HOST=https://api.tsyvinda.com
curl -s -c cookies.txt -X POST $HOST/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"<your-pw>"}'
curl -s -b cookies.txt $HOST/auth/me
curl -s -b cookies.txt -c cookies.txt -X POST $HOST/auth/refresh
curl -s -b cookies.txt -c cookies.txt -X POST $HOST/auth/logout -o /dev/null -w '%{http_code}\n'
```

---

## Live server — verification & rollback

### Inspect the prod DB (read-only, via SSH tunnel)

```bash
ssh -fN -L 5433:127.0.0.1:5432 deploy@<droplet-ip>
psql -h 127.0.0.1 -p 5433 -U api_tsyvinda -d app
```

Run the same SQL from the local section. Then close the tunnel: `pkill -f "ssh -fN -L 5433"`.

### Forcing a confirm without going through email (debug only)

Connect to prod DB and run:

```sql
UPDATE users SET email_verified = true WHERE email = 'qa+prod@example.com';
DELETE FROM email_verifications WHERE user_id = (SELECT id FROM users WHERE email = 'qa+prod@example.com');
```

Use sparingly; do not leave QA accounts un-cleaned.

### Cleanup of QA accounts

```sql
DELETE FROM users WHERE email LIKE 'qa+%@%';
-- CASCADE removes user_identities / email_verifications / refresh_tokens via FK
```

### Rollback the deploy

```bash
cd ~/app
git log --oneline -5
git checkout <previous-good-sha> -- src/
docker compose -f docker-compose.prod.yml up -d --build app
```

If a migration introduced bad schema, also run `npm run db:migration:revert` inside the app container.

---

## Reading the verification token in dev/test mode

The mock email branch logs at `debug` level via pino, and the dev logger is `pino-pretty` with level `debug`. The line looks like:

```
[22:48:12.345] DEBUG: email:verify (mocked)
    to: "qa+local@tsyvinda.com"
    url: "https://tsyvinda.local/registration?token=AbCdEf...XyZ"
```

In compose stack:

```bash
docker compose logs -f app | grep -i 'email:verify'
```

In native `npm run dev`:

```bash
npm run dev | grep -i 'email:verify'
```

The token is the value after `token=` in the URL. Anything 32+ chars passes the schema; the real DB lookup will only match the token from the most-recent verification row for the user.

---

## Common pitfalls

- **`401 UNAUTHENTICATED` on `/auth/refresh` immediately after login in Swagger**: the browser dropped the cookie because the Swagger origin differs from the cookie's `Domain`. Local: ensure `COOKIE_DOMAIN` is unset (host-only) or matches `api.tsyvinda.local`. Prod: `COOKIE_DOMAIN=.tsyvinda.com`.
- **`403 EMAIL_NOT_VERIFIED` after confirm**: you're confirming a different token than the latest one. The service uses the **most recently issued** token. Re-register or query the DB.
- **`409 EMAIL_TAKEN` while iterating QA**: delete the user (`DELETE FROM users WHERE email = ...`) or use `qa+1@`, `qa+2@`, …
- **`429 Too Many Requests` during a test sweep**: stricter limiter (10/min/IP) on register + login. Wait 60s or hit a different IP.
- **Resend `403` in prod logs**: `EMAIL_FROM` domain isn't verified in the Resend dashboard. Verify the domain + add the DNS records, then retry.
- **No email arrives in prod**: check the Resend dashboard → Logs for the actual delivery status. The app does not retry on `4xx`.
- **`secure` cookie not set in browser DevTools**: you hit HTTP instead of HTTPS. The cookie is `Secure`; browsers drop it on plain HTTP. Always use `https://` in dev (the mkcert cert covers `api.tsyvinda.local`).
- **Migration tooling fails with `Cannot find module 'ts-node'`**: install `ts-node` as a devDep (out of scope for the auth feature; see CLAUDE.md for current state). In dev, `synchronize: true` keeps things working without migrations.
