# Report: Auth Module (AUTH-001)

**Status**: ✅ Delivered
**Date**: 2026-05-20
**Plan**: `plans/auth.md`
**QA guide**: `docs/auth-qa.md`

---

## 1. Goal

Self-contained `auth` module for the blog backend providing email + password authentication with Resend-powered email confirmation, cookie-based JWT access + opaque rotating refresh tokens (both httpOnly cookies named `access` and `refresh`), and a `GET /auth/me` profile endpoint. Schema shaped to host Google OAuth later via a separate `user_identities` table without migrating `users`. Profile-image upload was deliberately deferred — only the `users.profile_image_url` column ships now.

---

## 2. Scope delivered

### Endpoints

| Method | Path                  | Auth             | Body in / body out                                          |
| ------ | --------------------- | ---------------- | ----------------------------------------------------------- |
| POST   | `/auth/register`      | —                | `{firstName,lastName,email,password,confirmPassword}` → `201 {message}` |
| POST   | `/auth/confirm-email` | —                | `{token}` → `200 {message}`                                 |
| POST   | `/auth/login`         | —                | `{email,password}` → `200 {user}` + sets `access` + `refresh` cookies |
| POST   | `/auth/refresh`       | `refresh` cookie | — → `200 {user}` + rotates both cookies                     |
| POST   | `/auth/logout`        | `refresh` cookie | — → `204` + clears both cookies                             |
| GET    | `/auth/me`            | `access` cookie  | — → `200 {id, firstName, lastName, email, profileImageUrl, emailVerified, createdAt}` |

### Tables

| Table                  | Purpose                                                         | Key columns                                                                          |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `users`                | Account profile                                                 | `email` (uniq), `password_hash` (nullable), `email_verified`, `profile_image_url`, `first_name`, `last_name`, `created_at`, `updated_at` |
| `user_identities`      | Provider link (`local` now; `google` later)                     | `(provider, provider_user_id)` unique; FK → `users.id` ON DELETE CASCADE             |
| `email_verifications`  | One-shot SHA-256-hashed confirmation tokens                     | `token_hash` (uniq), `expires_at`, `consumed_at`                                     |
| `refresh_tokens`       | SHA-256-hashed opaque refresh tokens with rotation chain        | `token_hash` (uniq), `expires_at`, `revoked_at`, `replaced_by_id`, `user_agent`, `ip` |

### Security choices

- **Password hashing** — `bcrypt`, cost 12 in prod, cost 4 in tests (via `BCRYPT_COST`).
- **Access JWT** — HS256, 15 min TTL, signed with `JWT_ACCESS_SECRET` (≥32 chars). Lives in the `access` httpOnly cookie at path `/`.
- **Refresh token** — opaque 32-byte base64url string. Only the SHA-256 hash is persisted. Lives in the `refresh` httpOnly cookie at path `/auth`. Rotated on every refresh; reuse of a revoked token triggers chain-revocation (theft detection).
- **Cookie attributes** — both cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=${COOKIE_DOMAIN}` (host-only when unset). Max-Age aligned with `REFRESH_TTL_DAYS`; the 15-min JWT exp is enforced server-side regardless of cookie lifetime.
- **CORS** — explicit allow-list = `FRONTEND_HOST[]` ∪ `https://${BACKEND_HOST}` (the latter lets Swagger UI work). `Access-Control-Allow-Credentials: true` so FE can send cookies cross-subdomain. CORS denial returns `403 CORS_DENIED`.
- **Rate limiting** — `register` and `login` each get an isolated 10-req/min/IP Redis-backed limiter (prefixes `rl:auth:register:`, `rl:auth:login:`) on top of the global 100/min limiter.
- **Enumeration safety** — login returns `401 INVALID_CREDENTIALS` for both "no such email" and "wrong password". Register intentionally returns `409 EMAIL_TAKEN` for UX.
- **Token-leak hygiene** — raw access JWTs, raw refresh tokens, and raw verification tokens are never logged. Pino's existing redact paths cover headers; auth code avoids body logging.

---

## 3. File layout

```
src/modules/auth/
  register/
    register.controller.ts
    register.routes.ts            (swagger JSDoc + rate-limit)
    register.schema.ts            (zod body schema)
  confirm-email/
    confirm-email.controller.ts
    confirm-email.routes.ts
    confirm-email.schema.ts
  login/
    login.controller.ts
    login.routes.ts
    login.schema.ts
  refresh/
    refresh.controller.ts
    refresh.routes.ts
  logout/
    logout.controller.ts
    logout.routes.ts
  me/
    me.controller.ts
    me.routes.ts
  auth.routes.ts                  (mount table for the six routers)
  auth.middleware.ts              (requireAuth reads `access` cookie)
  auth.service.ts                 (AuthService class: register, confirmEmail, login, rotateRefresh, logout, getProfile, issueSession; DI via DataSource + EmailService)
  cookies.ts                      (cookie helpers: setSessionCookies, clearSessionCookies, readAccessCookie, readRefreshCookie + UA/IP helpers)
  email.service.ts                (EmailService — Resend wrapper with 'test' sentinel bypass)
  password.ts                     (hashPassword, verifyPassword)
  tokens.service.ts               (signAccessToken, verifyAccessToken, generateOpaqueToken, hashOpaqueToken)
  schemas.shared.ts               (shared emailSchema + passwordSchema)
  email-verification.entity.ts
  refresh-token.entity.ts
  user-identity.entity.ts
  auth.routes.test.ts             (supertest integration)
  auth.service.test.ts            (in-memory repo fakes)
  password.test.ts
  tokens.service.test.ts
src/modules/users/
  user.entity.ts
```

Touched outside the auth module:

- `src/app.ts` — mounted `cookieParser()`, added `app.use('/auth', authRouter)`, rewrote CORS allow-list logic + added `credentials: true`.
- `src/config/app.config.ts` — added 7 env vars to the zod schema, exposed them as `config.auth`, `config.email`, `config.cookieDomain`.
- `src/config/app.config.test.ts` — covered new env required/length cases.
- `src/config/swagger.ts` — `cookieAuth` security scheme + `User` + `AuthLoginResponse` schemas.
- `src/shared/rate-limit.ts` — `buildRateLimiter` accepts `prefix` to isolate per-route counters.
- `vitest.config.ts` — `JWT_ACCESS_SECRET`, `RESEND_API_KEY=test`, `EMAIL_FROM`, `BCRYPT_COST=4`.
- `docker-compose.yml` + `docker-compose.prod.yml` — forwarded the 7 new env vars into the `app` container.
- `README.md` — new **Auth** section + 8 new env-var rows.
- `docs/auth-qa.md` — full manual QA guide.

Deleted: `src/modules/auth/auth.controller.ts`, `src/modules/auth/auth.schemas.ts` (replaced by per-endpoint files).

---

## 4. Architectural decisions

- **Per-endpoint subfolders** — every route owns its own `*.controller.ts`, `*.schema.ts`, `*.routes.ts`. Swagger JSDoc lives next to the route. `auth.routes.ts` is a thin mount table.
- **Shared service** — `AuthService` stays a single file because logic crosses endpoints (e.g. `issueSession` is reused by both login + refresh).
- **Cookie-only auth** — both tokens are HttpOnly cookies. No `Authorization: Bearer` flow. Frontend never touches the access token in JS — eliminates the XSS exfiltration vector. Cost: cross-site flows need `credentials: 'include'` and a CSRF strategy if FE/BE ever split to fully unrelated origins (not the case for `tsyvinda.com` + `api.tsyvinda.com`, which share registrable domain).
- **Opaque refresh, not JWT refresh** — denylist friendly: a single DB lookup per `/auth/refresh` lets us revoke a token at any time and detect reuse. The DB round-trip is acceptable for a blog's traffic profile.
- **DB-backed verification tokens** — durable across restarts; same pattern reusable for password reset later.
- **Separate `user_identities` table** — clean multi-provider linking when Google OAuth ships. Adds a row at register; never modifies `users`.
- **`'test'` Resend sentinel** — when `RESEND_API_KEY=test`, `EmailService` short-circuits to `logger.debug({to,url})`. CI never makes outbound HTTP. Tests still assert call args.
- **No new logger middleware** — relies on existing pino + pino-http; redact paths already cover `authorization` / `cookie` headers and `*.password`/`*.token` keys.

---

## 5. Environment variables added

| Variable             | Required | Default | Notes                                                            |
| -------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`  | ✅       | —       | ≥32 chars; generate via `node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'` |
| `JWT_ACCESS_TTL`     | —        | `15m`   | jsonwebtoken-style duration                                      |
| `REFRESH_TTL_DAYS`   | —        | `30`    | Drives DB `expires_at` + cookie `Max-Age`                        |
| `BCRYPT_COST`        | —        | `12`    | Tests use 4                                                       |
| `RESEND_API_KEY`     | ✅       | —       | Literal `test` bypasses the Resend HTTP call                     |
| `EMAIL_FROM`         | ✅       | —       | e.g. `"Blog <noreply@tsyvinda.com>"` — domain must be verified in Resend in prod |
| `COOKIE_DOMAIN`      | —        | unset   | `.tsyvinda.com` for shared FE+BE registrable domain              |

`.env*` files are denylisted from Claude's write surface — the developer adds these manually. Compose files now forward all of them via `environment:` blocks.

---

## 6. Testing

| File                                | Tests | Coverage                                                                                  |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `password.test.ts`                  | 3     | Hash + verify + salt randomness                                                            |
| `tokens.service.test.ts`            | 6     | Sign/verify roundtrip, expired, wrong-secret, wrong-type, opaque token shape, deterministic hash |
| `auth.service.test.ts`              | 18    | All service paths against in-memory `FakeRepo` + fake `DataSource` + fake `EmailService`  |
| `auth.routes.test.ts`               | 13    | Supertest integration with mocked `authService` + cookie wiring + middleware              |
| (plus pre-existing app/config/error tests) | 14    | Unchanged                                                                                  |

**Total: 7 files / 54 tests / 100 % passing.** Typecheck + ESLint also clean.

Service-layer tests use a tiny in-memory `FakeRepo` that supports `create / save (single or array) / findOne / find / update`. Routes-layer tests use `vi.hoisted` + `vi.mock` to stub the service.

---

## 7. CI / build status

| Step                                                | Result                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run typecheck`                                 | ✅ clean                                                                                |
| `npm run lint`                                      | ✅ clean                                                                                |
| `npm run build`                                     | ✅ clean                                                                                |
| `npm test`                                          | ✅ 54/54                                                                                |
| `npm run format:check`                              | ⚠️ pre-existing warnings on `.claude/*`, `CLAUDE.md`, `error-handler.test.ts`; `.env.example` blocked by Claude permission denylist. No new auth files in the warn list. |

---

## 8. Deployment / migration

- **Dev** — `synchronize: true` creates all four new tables on the first boot after `docker compose up --build`.
- **Prod** — a TypeORM migration capturing the new schema was intended via `npm run db:migration:generate -- src/migrations/CreateAuth`. Blocked: `ts-node` devDep is missing from `package.json`. Pre-existing tooling gap, not introduced by this work. Recommended follow-up: install `ts-node` and emit the migration before the next prod deploy.

### Live deployment checklist

1. Set `JWT_ACCESS_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `COOKIE_DOMAIN=.tsyvinda.com` in `~/app/.env` on the droplet.
2. Verify the `EMAIL_FROM` domain in the Resend dashboard (otherwise sends fail with 403).
3. `git pull && docker compose -f docker-compose.prod.yml up -d --build app`.
4. Inspect `/health` and `/docs` — six `/auth/*` routes must appear.
5. Run the live walkthrough from `docs/auth-qa.md` against the droplet.

---

## 9. Phase log

| Phase | Description                                              | Status |
| ----- | -------------------------------------------------------- | ------ |
| 1     | Dependencies, env, shared utilities                      | ✅      |
| 2     | Entities (`users`, `user_identities`, `email_verifications`, `refresh_tokens`) | ✅      |
| 3     | Service / controller / routes / middleware              | ✅      |
| 4     | Swagger polish + DTOs (folded into Phase 3 + 6)         | ✅      |
| 5     | Tests (54/54 passing)                                    | ✅      |
| 6     | Migration + README + final sweep                         | ✅ (migration generation blocked on `ts-node` — see Section 8) |
| 7     | (Post-plan) Per-endpoint subfolder reorg + CORS hardening + cookie-only auth + manual QA doc | ✅      |

---

## 10. Out of scope (follow-up work)

- **Profile-image upload** — proposition recorded: DigitalOcean Spaces (S3-compatible) + `multer` memory storage + `sharp` (resize, strip EXIF, encode webp) + `@aws-sdk/client-s3`. Store the CDN URL in `users.profile_image_url`. Local-disk and Postgres-bytea rejected.
- **Google OAuth** — schema is ready (`user_identities`, nullable `users.password_hash`). Implementation: `POST /auth/google` doing OIDC code exchange + `findOrCreateBySocial({provider:'google', providerUserId, email, firstName, lastName})` on the service; cookies issued by reusing `issueSession`.
- **Password reset** — `POST /auth/forgot-password` + `POST /auth/reset-password`. Reuses the verification-token + email-service pattern from this plan.
- **Resend verification email** — `POST /auth/resend-verification` with per-user rate limit.
- **"Log out from all devices"** — sweep `refresh_tokens` for the user. Already supported by the schema; just needs the endpoint.
- **CSRF protection** — only needed if FE and BE move to truly cross-site origins (different registrable domains). The current Lax + shared-domain setup mitigates CSRF for state-changing requests.
- **`ts-node` install** — enables `db:migration:generate` / `db:migration:run` for prod migrations.
- **Real `db:migration:generate -- src/migrations/CreateAuth`** — emit a migration file from the live entities once `ts-node` is in place.

---

## 11. Known issues / risks

- **`format:check` regression** — not introduced here. Pre-existing `.env.example` permission error and `.claude/*` files break the check. Auth files all pass Prettier. Treat as legacy debt.
- **No production migration emitted yet** — see Section 8. Dev is safe via `synchronize: true`; prod requires the migration or a one-time manual schema apply before deploy.
- **Compose env forwarding** — the original compose files did not forward the new env vars. Updated both `docker-compose.yml` and `docker-compose.prod.yml`. Re-run `docker compose up -d --build` whenever you add new vars to `app.config.ts`.

---

## 12. Verification on local stack

Verified end-to-end during this work against `https://api.tsyvinda.local`:

- Registered `vladyslav@tsyvinda.com` via Swagger UI — `201` + verification URL logged.
- Confirmed via Swagger — `200`, `email_verified = true` in DB.
- Login via Swagger — `200` with `{user}` in body; `access` and `refresh` cookies set in DevTools (HttpOnly, Secure, SameSite=Lax, paths `/` and `/auth`).
- `/auth/me` via Swagger — `200` with profile, cookie attached automatically.
- CORS: same-origin Swagger requests pass after the `BACKEND_HOST` allow-list addition; previously rejected with `Not allowed by CORS`.
