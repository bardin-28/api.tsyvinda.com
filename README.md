# test-be

Node.js / Express / TypeScript API with Docker support for local dev and production (DigitalOcean).

Stack: Express 4, TypeORM, Postgres 18.4, Redis 8, Swagger UI, Helmet, rate-limit, behind `nginx-proxy` + `acme-companion` for TLS in production.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Environment](#environment)
- [Development (Docker)](#development-docker)
- [Development (local, no Docker)](#development-local-no-docker)
- [Scripts](#scripts)
- [Production — first-time deploy](#production--first-time-deploy)
- [Production — updates](#production--updates)
- [Database access](#database-access)
- [Backups](#backups)
- [Environment variables](#environment-variables)
- [Auth](#auth)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2 (not v1; v1 is EOL and incompatible with current image format)
- [Node.js 22](https://nodejs.org/) — only for local dev without Docker; see `.nvmrc`
- [mkcert](https://github.com/FiloSottile/mkcert) — only for local HTTPS via nginx-proxy

Verify compose v2 (note the space, not dash):

```bash
docker compose version
# Docker Compose version v2.x.x
```

---

## Environment

```bash
cp .env.example .env
# edit .env with your values
```

For local HTTPS via nginx-proxy add to `/etc/hosts`:

```
127.0.0.1 api.tsyvinda.local
```

Generate local mkcert TLS pair:

```bash
npm run cert
```

This reads `BACKEND_HOST` from `.env.local` and writes `nginx-certs/<host>.crt` + `<host>.key`.

---

## Development (Docker)

Runs app with hot-reload (nodemon + tsx). Postgres and Redis included; nginx-proxy provides HTTPS at `BACKEND_HOST`.

```bash
docker compose up --build
```

- API (HTTPS): `https://api.tsyvinda.local`
- Swagger UI: `https://api.tsyvinda.local/docs`
- Postgres: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

Postgres and Redis are bound to `127.0.0.1` only — not exposed on the LAN.

Stop:

```bash
docker compose down
```

---

## Development (local, no Docker)

Run only Postgres + Redis in Docker, app natively:

```bash
docker compose up -d postgres redis
npm install
npm run dev
```

App reachable at `http://localhost:3000`.

---

## Scripts

| Script                            | Purpose                        |
| --------------------------------- | ------------------------------ |
| `npm run dev`                     | Hot-reload via tsx + nodemon   |
| `npm run build`                   | TypeScript compile to `dist/`  |
| `npm start`                       | Run compiled output            |
| `npm run typecheck`               | `tsc --noEmit`                 |
| `npm run lint` / `lint:fix`       | ESLint                         |
| `npm run format` / `format:check` | Prettier                       |
| `npm test` / `test:watch`         | Vitest                         |
| `npm run cert`                    | Generate local mkcert TLS pair |

---

## Production — first-time deploy

### 1. Provision droplet

DigitalOcean Ubuntu 24.04, smallest tier ok for small APIs. SSH in as `root`.

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban unattended-upgrades
```

### 2. Create non-root user

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

### 3. SSH hardening — edit `/etc/ssh/sshd_config`

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
systemctl restart ssh
```

Test login as `deploy@<ip>` in a separate terminal **before** disconnecting root.

### 4. Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 5. Swap (if RAM ≤ 2GB)

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 6. Auto security updates

```bash
dpkg-reconfigure --priority=low unattended-upgrades
```

### 7. Install Docker + Compose v2

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
# logout and back in as deploy
```

If droplet has the old `docker-compose` (v1, Python) package, remove it:

```bash
sudo apt remove -y docker-compose
```

Verify v2 plugin:

```bash
docker compose version
```

### 8. DNS

In GoDaddy (or your DNS provider) create an `A` record:

| Field       | Value                          |
| ----------- | ------------------------------ |
| Type        | `A`                            |
| Name (Host) | `api` (for `api.tsyvinda.com`) |
| Value       | droplet IPv4                   |
| TTL         | `600`                          |

Wait for propagation:

```bash
dig +short api.tsyvinda.com
# must return droplet IP before next step — acme-companion will fail otherwise
```

### 9. Clone repo

If using SSH (recommended):

```bash
ssh-keygen -t ed25519 -C "deploy@droplet"
cat ~/.ssh/id_ed25519.pub
# add the output to GitHub → Settings → SSH and GPG keys
ssh -T git@github.com
git clone git@github.com:bardin-28/api.tsyvinda.com.git ~/app
```

Or HTTPS:

```bash
git clone https://github.com/bardin-28/api.tsyvinda.com.git ~/app
```

### 10. Prod `.env`

Generate strong secrets locally and `scp` the file to the droplet, or create on the droplet directly. Sample content:

```env
COMPOSE_PROJECT_NAME=api-tsyvinda

BACKEND_HOST=api.tsyvinda.com
LETSENCRYPT_EMAIL=you@example.com

NODE_ENV=production
PORT=3000
FRONTEND_HOST=https://tsyvinda.com

BASIC_AUTH=false
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=<random>

POSTGRES_USER=api_tsyvinda
POSTGRES_PASSWORD=<random>
POSTGRES_DB=app
DATABASE_URL=postgresql://api_tsyvinda:<random>@postgres:5432/app

REDIS_URL=redis://redis:6379
```

Generate random:

```bash
openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 40
```

`POSTGRES_PASSWORD` and the password in `DATABASE_URL` **must match exactly**. Avoid `@ : / # ?` in passwords (break the URL) — the `tr -dc 'A-Za-z0-9'` filter above ensures alnum-only.

Copy to droplet from your laptop:

```bash
scp .env.production deploy@<droplet-ip>:~/app/.env
ssh deploy@<droplet-ip> "chmod 600 ~/app/.env"
```

### 11. Start the stack

```bash
ssh deploy@<droplet-ip>
cd ~/app
docker compose -f docker-compose.prod.yml up -d --build
```

Verify all 5 services up:

```bash
docker compose -f docker-compose.prod.yml ps
# expected: nginx-proxy, acme-companion, app, postgres, redis — all "running" / "healthy"
```

Watch acme-companion issue the cert:

```bash
docker compose -f docker-compose.prod.yml logs -f acme-companion
# look for: "Creating/renewal of api.tsyvinda.com certificates"
```

### 12. Verify

```bash
curl -i https://api.tsyvinda.com/health
# HTTP/2 200
# {"status":"ok","db":true,"redis":true}
```

Open Swagger UI: `https://api.tsyvinda.com/docs`.

---

## Production — updates

### Update app code

```bash
cd ~/app
git pull
docker compose -f docker-compose.prod.yml up -d --build app
```

Only `app` rebuilds; Postgres/Redis/nginx untouched.

### Update base images (postgres / redis / nginx-proxy / acme-companion)

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
```

> Postgres major upgrade (e.g. 18 → 19) is **not** automatic. Dump → upgrade → restore. See [Backups](#backups).

### Update system

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
sudo reboot   # if kernel updated
```

### Restart app without redeploy

```bash
docker compose -f docker-compose.prod.yml restart app
```

### Tail logs

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f nginx-proxy
docker compose -f docker-compose.prod.yml logs -f acme-companion
```

### Disk cleanup

```bash
docker system prune -af
sudo journalctl --vacuum-time=7d
```

---

## Database access

Postgres in prod is bound to `127.0.0.1:5432` on the droplet — not reachable from the public internet. Access via SSH tunnel.

### SSH tunnel (DBeaver / TablePlus / psql)

From your laptop:

```bash
ssh -fN -L 5433:127.0.0.1:5432 deploy@<droplet-ip>
# -f background, -N no shell
```

Connect a client to `localhost:5433`:

| Field    | Value                           |
| -------- | ------------------------------- |
| Host     | `localhost`                     |
| Port     | `5433`                          |
| User     | `api_tsyvinda` (from `.env`)    |
| Password | `POSTGRES_PASSWORD` from `.env` |
| Database | `app`                           |

Close the tunnel:

```bash
pkill -f "ssh -fN -L 5433"
```

### psql directly inside the container

```bash
ssh deploy@<droplet-ip>
cd ~/app
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U api_tsyvinda -d app
```

---

## Backups

### One-off dump (prod → laptop)

```bash
ssh deploy@<droplet-ip> "docker compose -f ~/app/docker-compose.prod.yml exec -T postgres \
  pg_dump -U api_tsyvinda -d app -Fc" > backup-$(date +%F).dump
```

### Restore to local dev DB

```bash
docker compose up -d postgres
docker compose exec -T postgres \
  pg_restore -U postgres -d app --clean --if-exists < backup-2026-05-15.dump
```

### Restore to prod (destructive — `--clean` drops tables)

```bash
cat local-backup.dump | ssh deploy@<droplet-ip> \
  "docker compose -f ~/app/docker-compose.prod.yml exec -T postgres \
   pg_restore -U api_tsyvinda -d app --clean --if-exists"
```

### Nightly backup cron

`/etc/cron.d/api-backup` on droplet:

```cron
0 3 * * * deploy cd /home/deploy/app && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U api_tsyvinda -d app -Fc | gzip > /home/deploy/backups/db-$(date +\%F).dump.gz && find /home/deploy/backups -name 'db-*.dump.gz' -mtime +14 -delete
```

Nightly dump to `~/backups`, gzip, 14-day retention. Push to S3/Backblaze separately for off-site copy.

---

## Environment variables

| Variable               | Dev default            | Required in prod                      |
| ---------------------- | ---------------------- | ------------------------------------- |
| `NODE_ENV`             | `development`          | `production`                          |
| `PORT`                 | `3000`                 | optional                              |
| `COMPOSE_PROJECT_NAME` | `api-tsyvinda-local`   | yes                                   |
| `RESTART_POLICY`       | `no`                   | n/a (prod hardcoded `unless-stopped`) |
| `BACKEND_HOST`         | `api.tsyvinda.local`   | real domain                           |
| `FRONTEND_HOST`        | `https://tsyvinda.com` | yes (CORS origin)                     |
| `LETSENCRYPT_EMAIL`    | —                      | yes                                   |
| `POSTGRES_USER`        | `postgres`             | yes                                   |
| `POSTGRES_PASSWORD`    | `postgres`             | strong random                         |
| `POSTGRES_DB`          | `app`                  | yes                                   |
| `DATABASE_URL`         | local connection       | match POSTGRES_PASSWORD               |
| `REDIS_URL`            | local connection       | `redis://redis:6379` in compose       |
| `BASIC_AUTH`           | `false`                | optional                              |
| `BASIC_AUTH_USERNAME`  | `admin`                | only if `BASIC_AUTH=true`             |
| `BASIC_AUTH_PASSWORD`  | `password`             | only if `BASIC_AUTH=true`             |
| `JWT_ACCESS_SECRET`    | —                      | yes (≥32 random chars)                |
| `JWT_ACCESS_TTL`       | `15m`                  | optional (e.g. `15m`, `1h`)           |
| `REFRESH_TTL_DAYS`     | `30`                   | optional                              |
| `BCRYPT_COST`          | `12`                   | optional (4 in tests for speed)       |
| `RESEND_API_KEY`       | `test`                 | yes (`test` bypasses send)            |
| `EMAIL_FROM`           | —                      | yes (e.g. `Blog <noreply@x.com>`)     |
| `COOKIE_DOMAIN`        | —                      | optional (`.tsyvinda.com` for shared) |

`FRONTEND_HOST`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` are validated at boot — app refuses to start without them.

Generate a `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## Auth

Email + password authentication with email confirmation via Resend. Both access and refresh tokens live in httpOnly cookies named `access` and `refresh`. Schema accommodates Google OAuth later via a separate `user_identities` table.

### Endpoints

| Method | Path                  | Auth         | Purpose                                                          |
| ------ | --------------------- | ------------ | ---------------------------------------------------------------- |
| POST   | `/auth/register`      | —            | Create account; sends Resend verification email                  |
| POST   | `/auth/confirm-email` | —            | Confirm email using the token from the email link                |
| POST   | `/auth/login`         | —            | Sets `access` + `refresh` cookies; body returns `{ user }`       |
| POST   | `/auth/refresh`       | refresh cookie | Rotates both cookies; body returns `{ user }`                  |
| POST   | `/auth/logout`        | refresh cookie | Revokes refresh, clears both cookies                           |
| GET    | `/auth/me`            | access cookie | Returns the authenticated user's profile                        |

### Token model

- **Access JWT** — HS256, 15-min TTL, signed with `JWT_ACCESS_SECRET`. Lives in the `access` httpOnly cookie at path `/`. Browser sends it automatically on every request.
- **Refresh token** — opaque 32-byte random value (base64url). Persisted hashed (SHA-256) in the `refresh_tokens` table. Lives in the `refresh` httpOnly cookie scoped to `/auth` so it is only attached to refresh/logout requests. Rotated on every `/auth/refresh`; reuse of a revoked token revokes the entire user chain (theft detection).
- **Cookie attributes** — both cookies: `HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}`. `access` path `/`, `refresh` path `/auth`. Max-Age aligned with `REFRESH_TTL_DAYS`; server enforces the 15-min JWT exp inside the access cookie and FE silently refreshes on 401.

### Verification email

The link in the email points to `${FRONTEND_HOST}/registration?token=${rawToken}`. The frontend should read `token` from the URL and POST it to `/auth/confirm-email`. Tokens expire after 24 hours and are single-use.

### Sample curl

```bash
# Register
curl -X POST https://api.tsyvinda.com/auth/register \
  -H 'content-type: application/json' \
  -d '{"firstName":"Vlad","lastName":"T","email":"vlad@example.com","password":"Secret123","confirmPassword":"Secret123"}'

# Confirm email (token from the email)
curl -X POST https://api.tsyvinda.com/auth/confirm-email \
  -H 'content-type: application/json' \
  -d '{"token":"<token-from-email>"}'

# Login (capture both cookies)
curl -i -c cookies.txt -X POST https://api.tsyvinda.com/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"vlad@example.com","password":"Secret123"}'

# Profile (sends access cookie automatically)
curl -b cookies.txt https://api.tsyvinda.com/auth/me

# Refresh (rotates both cookies)
curl -b cookies.txt -c cookies.txt -X POST https://api.tsyvinda.com/auth/refresh

# Logout (clears both cookies)
curl -b cookies.txt -c cookies.txt -X POST https://api.tsyvinda.com/auth/logout
```

### Cross-origin notes

When the FE (`tsyvinda.com`) and BE (`api.tsyvinda.com`) share a registrable domain, set `COOKIE_DOMAIN=.tsyvinda.com` and `SameSite=Lax` works for both cookies. Frontend `fetch` must use `credentials: 'include'` on every call so the access cookie is attached. If FE/BE ever move to fully cross-site origins, switch `sameSite` to `'none'` in `src/modules/auth/cookies.ts` and ensure CORS sends `Access-Control-Allow-Credentials: true` (already enabled in `src/app.ts`).

---

## Project structure

```
src/
  config/       # app, db, redis, swagger config
  modules/
    auth/       # register/confirm-email/login/refresh/logout/me + entities
    health/     # health check
    users/      # User entity
  shared/       # validate, asyncHandler, http-error, error-handler, rate-limit
  app.ts        # express setup (helmet, cors, rate-limit, cookie-parser, swagger, routes)
  index.ts      # entrypoint (boot, graceful shutdown)
docker/
  nginx-proxy/  # custom nginx-proxy image (basic auth, custom.conf)
.github/workflows/ci.yml   # lint + typecheck + build + test
docker-compose.yml         # dev
docker-compose.prod.yml    # production (nginx-proxy + acme-companion + app + db + redis)
Dockerfile                 # multi-stage: development / builder / production
```

---

## Troubleshooting

### `KeyError: 'ContainerConfig'`

Old `docker-compose` v1 (Python) in use. Switch to v2 plugin (`docker compose` with space):

```bash
sudo apt remove -y docker-compose
docker compose version
```

### Postgres exits with `data directory is in 18+ vs 16` format error

Volume contains data from a previous Postgres major version. Either:

- restore from a dump (see [Backups](#backups)), or
- if data is disposable: `docker compose -f docker-compose.prod.yml down` → `docker volume rm api-tsyvinda_postgres-data` → `up -d` (irreversible: wipes DB)

### `npm run build` exits with code 127

Builder stage missing `devDependencies` (`tsc` not found). Ensure `npm ci --include=dev` in the builder stage (default Dockerfile already does this).

### acme-companion fails to issue cert

DNS not propagated yet. Check `dig +short api.tsyvinda.com` from the droplet. Wait, then `docker compose -f docker-compose.prod.yml restart acme-companion`. Let's Encrypt rate limit: 5 fails/hour per domain.

### Swagger UI shows "No operations defined in spec!"

Swagger looks for source files that don't exist in the prod image. Already fixed in `src/config/swagger.ts` (glob resolves to both `.ts` and compiled `.js`). If still empty after rebuild, verify JSDoc comments survive `tsc` — `removeComments` must not be `true` in `tsconfig.json`.

### Swagger UI blank page / CSP errors in console

`helmet()`'s default CSP blocks Swagger's inline init script. `src/app.ts` disables CSP for `/docs` only. Rebuild app: `docker compose -f docker-compose.prod.yml up -d --build app`.

### App can't connect to Postgres

- Verify `POSTGRES_PASSWORD` matches the password inside `DATABASE_URL` exactly
- Verify host in `DATABASE_URL` is `postgres` (service name), not `localhost`
- `docker compose -f docker-compose.prod.yml logs postgres`

### Rate-limit returns 429 unexpectedly

`app.set('trust proxy', 1)` accepts 1 hop. If you add Cloudflare or another proxy in front of nginx-proxy, increase the hop count in `src/app.ts`.

### Out of disk space

```bash
docker system prune -af
sudo journalctl --vacuum-time=7d
du -sh /var/lib/docker/* | sort -h
```
