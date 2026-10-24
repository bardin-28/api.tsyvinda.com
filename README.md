# tsyvinda.com — back-end

pnpm + Turborepo monorepo:

| Workspace                                            | Stack                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/api`                                           | NestJS 11 · TypeORM · Postgres 18 · Redis 8 · Swagger · cookie JWT auth |
| `apps/admin`                                         | Admin panel: React-Admin 5 · MUI 9 · Vite (login + dashboard)           |
| `packages/shared-types`                              | Types shared by api and admin                                           |
| `packages/eslint-config`, `packages/prettier-config` | Shared lint / format config                                             |

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Environment](#environment)
- [Development (Docker)](#development-docker)
- [Development (local, no Docker)](#development-local-no-docker)
- [Scripts](#scripts)
- [Admin panel](#admin-panel)
- [Production](#production)
- [Environment variables](#environment-variables)
- [Auth](#auth)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2 (not v1; v1 is EOL and incompatible with current image format)
- [Node.js 22](https://nodejs.org/) (see `.nvmrc`) + `corepack enable` (pnpm version comes from `packageManager`)
- [mkcert](https://github.com/FiloSottile/mkcert) — only for local HTTPS via nginx-proxy

Verify compose v2 (note the space, not dash):

```bash
docker compose version
# Docker Compose version v2.x.x
```

---

## Environment

One `.env` at the repo root for every workspace:

```bash
cp .env.example .env
# edit .env with your values
```

For local HTTPS via nginx-proxy add to `/etc/hosts`:

```
127.0.0.1 api.tsyvinda.local admin.tsyvinda.local tsyvinda.local
```

Generate local mkcert TLS pairs:

```bash
pnpm cert
```

This reads `BACKEND_HOST`, `ADMIN_HOST` and `FRONTEND_LOCAL_HOST` (default `tsyvinda.local`) from `.env` and writes `nginx-certs/<host>.crt` + `<host>.key` for each.

---

## Development (Docker)

Runs the API with hot-reload (nodemon + ts-node) and the admin panel (Vite dev server). Postgres, Redis, Mailpit and MiniStack included; nginx-proxy provides HTTPS.

```bash
docker compose up --build
```

- API (HTTPS): `https://api.tsyvinda.local`
- Swagger UI: `https://api.tsyvinda.local/docs` (admin API: `/docs-admin`)
- Admin panel: `https://admin.tsyvinda.local/admin`
- fe: `https://tsyvinda.local` — run `npm run dev:local` in `../fe` (next dev on the host's :3000; the `fe-proxy` service forwards to it, 502 while it isn't running). Keep `https://tsyvinda.local` in `FRONTEND_HOST`.
- Postgres: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

Postgres and Redis are bound to `127.0.0.1` only — not exposed on the LAN.

Stop:

```bash
docker compose down
```

---

## Development (local, no Docker)

Run only the dependencies in Docker, the API natively:

```bash
docker compose up -d postgres redis mailpit ministack s3-init
pnpm install
pnpm db:migration:run
pnpm dev:api
```

API reachable at `http://localhost:3000`. The admin panel needs HTTPS on `ADMIN_HOST` (its session cookies are `Secure`), so run it through compose.

---

## Scripts

Run from the repo root.

| Script                                          | Purpose                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| `pnpm dev` / `dev:api` / `dev:admin`            | Hot-reload (api: nodemon + ts-node, admin: Vite) |
| `pnpm build`                                    | Build every workspace                            |
| `pnpm typecheck`                                | `tsc --noEmit` everywhere                        |
| `pnpm lint` / `lint:fix`                        | ESLint                                           |
| `pnpm format` / `format:check`                  | Prettier                                         |
| `pnpm test`                                     | Vitest (api + admin)                             |
| `pnpm db:migration:run` / `revert` / `generate` | TypeORM migrations (api)                         |
| `pnpm email:dev`                                | React-email preview server                       |
| `pnpm cert`                                     | Generate local mkcert TLS pairs                  |

---

## Admin panel

React-Admin app in `apps/admin`, served under `/admin` on its own host (`ADMIN_HOST`, prod: `admin.tsyvinda.com`). It talks to the API's admin surface at `https://<BACKEND_HOST>/admin/*`.

- **Sign-in**: `POST /admin/auth/login` — only users with `role = ADMIN`. Sessions use their own httpOnly cookies (`admin_access` / `admin_refresh`, `Path=/admin`), separate from the website session.
- **Default admin**: `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD` (12+ chars). Created on API boot if missing; an existing user with that email is promoted to ADMIN; a password is never overwritten.
- **Dashboard**: `GET /admin/dashboard` — user and post counts, latest signups.
- **Posts**: create, edit and delete any post (`/admin/posts`), cover image upload, content editor with a Visual / HTML source switch. Post HTML is rendered as-is on the website — only admins can write it.
- **Build**: `docker build -f apps/admin/Dockerfile --build-arg ADMIN_PUBLIC_API_URL=https://api.tsyvinda.com/admin .` — the API URL is baked in at build time (one image per environment).

---

## Production

Prod runs on K3s on a single EC2 node in AWS `eu-central-1`, deployed by ArgoCD from the infra repo
(`bardin-28/infra.tsyvinda.com`). On every push to `main`, CI builds the API (and admin) image, pushes it to
ECR and bumps the image tag in the infra repo; ArgoCD rolls it out and runs migrations as a pre-sync Job.

- **Postgres**: AWS RDS (`db.t4g.micro`), private — reachable only from inside the VPC.
- **Redis**: in-cluster.
- **Uploads**: S3 bucket behind CloudFront (`https://cdn.tsyvinda.com`).
- **Config + secrets**: Helm values and the backend Secret in the infra repo — no env file in this repo.

Infrastructure, deploy and runbooks live in the infra repo (`docs/`).

### Restore a dump to the local dev DB

```bash
docker compose up -d postgres
docker compose exec -T postgres \
  pg_restore -U postgres -d app --clean --if-exists < backup.dump
```

---

## Environment variables

| Variable               | Dev default            | Required in prod                      |
| ---------------------- | ---------------------- | ------------------------------------- |
| `NODE_ENV`             | `development`          | `production`                          |
| `PORT`                 | `3000`                 | optional                              |
| `COMPOSE_PROJECT_NAME` | `api-tsyvinda-local`   | n/a (local compose only)              |
| `RESTART_POLICY`       | `no`                   | n/a (local compose only)              |
| `BACKEND_HOST`         | `api.tsyvinda.local`   | real domain                           |
| `FRONTEND_HOST`        | `https://tsyvinda.com` | yes (CORS origin)                     |
| `POSTGRES_USER`        | `postgres`             | yes                                   |
| `POSTGRES_PASSWORD`    | `postgres`             | strong random                         |
| `POSTGRES_DB`          | `app`                  | yes                                   |
| `DATABASE_URL`         | local connection       | match POSTGRES_PASSWORD               |
| `REDIS_URL`            | local connection       | in-cluster Redis                      |
| `JWT_ACCESS_SECRET`    | —                      | yes (≥32 random chars)                |
| `JWT_ACCESS_TTL`       | `15m`                  | optional (e.g. `15m`, `1h`)           |
| `REFRESH_TTL_DAYS`     | `30`                   | optional                              |
| `BCRYPT_COST`          | `12`                   | optional (4 in tests for speed)       |
| `SMTP_HOST`            | `localhost` (Mailpit)  | yes (Resend SMTP relay)               |
| `SMTP_PASS`            | —                      | yes (Resend API key)                  |
| `EMAIL_FROM`           | —                      | yes (e.g. `Blog <noreply@x.com>`)     |
| `COOKIE_DOMAIN`        | —                      | optional (`.tsyvinda.com` for shared) |

Env is validated at boot (`apps/api/src/shared/app.config.ts`) — the API refuses to start without `DATABASE_URL`, `JWT_ACCESS_SECRET`, `EMAIL_FROM`, `S3_BUCKET` and `S3_PUBLIC_URL`; in production also `SMTP_HOST` and `TURNSTILE_SECRET_KEY`.

Generate a `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## Auth

Email + password authentication with email confirmation via Resend. Both access and refresh tokens live in httpOnly cookies named `access` and `refresh`. Schema accommodates Google OAuth later via a separate `user_identities` table.

### Endpoints

| Method | Path                  | Auth           | Purpose                                                    |
| ------ | --------------------- | -------------- | ---------------------------------------------------------- |
| POST   | `/auth/register`      | —              | Create account; sends Resend verification email            |
| POST   | `/auth/confirm-email` | —              | Confirm email using the token from the email link          |
| POST   | `/auth/login`         | —              | Sets `access` + `refresh` cookies; body returns `{ user }` |
| POST   | `/auth/refresh`       | refresh cookie | Rotates both cookies; body returns `{ user }`              |
| POST   | `/auth/logout`        | refresh cookie | Revokes refresh, clears both cookies                       |
| GET    | `/auth/me`            | access cookie  | Returns the authenticated user's profile                   |

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
  nginx-proxy/  # local nginx-proxy config (custom.conf, MiniStack /s3 location)
.github/workflows/ci.yml   # lint + typecheck + build + test
docker-compose.yml         # dev
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

- restore from a dump (see [Restore a dump](#restore-a-dump-to-the-local-dev-db)), or
- if data is disposable: `docker compose down` → `docker volume rm <project>_postgres-data` → `up -d` (irreversible: wipes DB)

### `npm run build` exits with code 127

Builder stage missing `devDependencies` (`tsc` not found). Ensure `npm ci --include=dev` in the builder stage (default Dockerfile already does this).

### Swagger UI shows "No operations defined in spec!"

Swagger looks for source files that don't exist in the prod image. Already fixed in `src/config/swagger.ts` (glob resolves to both `.ts` and compiled `.js`). If still empty after rebuild, verify JSDoc comments survive `tsc` — `removeComments` must not be `true` in `tsconfig.json`.

### Swagger UI blank page / CSP errors in console

`helmet()`'s default CSP blocks Swagger's inline init script. `src/app.ts` disables CSP for `/docs` only. Rebuild app: `docker compose up -d --build app`.

### App can't connect to Postgres

- Verify `POSTGRES_PASSWORD` matches the password inside `DATABASE_URL` exactly
- Verify host in `DATABASE_URL` is `postgres` (service name), not `localhost`
- `docker compose logs postgres`

### Rate-limit returns 429 unexpectedly

`app.set('trust proxy', 1)` accepts 1 hop. If you add Cloudflare or another proxy in front of nginx-proxy, increase the hop count in `src/app.ts`.

### Out of disk space

```bash
docker system prune -af
sudo journalctl --vacuum-time=7d
du -sh /var/lib/docker/* | sort -h
```
