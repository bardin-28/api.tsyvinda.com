# test-be

Node.js / Express / TypeScript API with Docker support for local dev and production (DigitalOcean).

Stack: Express 4, TypeORM, Postgres 18, Redis 8, Swagger UI, Helmet, rate-limit, behind `nginx-proxy` + `acme-companion` for TLS in production.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2
- [Node.js 22](https://nodejs.org/) (only for local dev without Docker; see `.nvmrc`)
- [mkcert](https://github.com/FiloSottile/mkcert) (only for local HTTPS via nginx-proxy)

---

## Environment setup

```bash
cp .env.example .env
# edit .env with your values
```

Local HTTPS via nginx-proxy needs a host entry. Add to `/etc/hosts`:

```
127.0.0.1 api.tsyvinda.local
```

Generate a local cert trusted by your OS:

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
- API (HTTP, app-direct): `http://localhost:3000` (only if you bypass proxy)
- Swagger: `https://api.tsyvinda.local/docs`
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

| Script | Purpose |
|---|---|
| `npm run dev` | Hot-reload via tsx + nodemon |
| `npm run build` | TypeScript compile to `dist/` |
| `npm start` | Run compiled output |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:watch` | Vitest |
| `npm run cert` | Generate local mkcert TLS pair |

---

## Production (DigitalOcean)

### 1. Server setup

```bash
git clone <repo-url> /app
cd /app
cp .env.example .env
```

Edit `.env` for production — at minimum:

```env
NODE_ENV=production
COMPOSE_PROJECT_NAME=api-tsyvinda
BACKEND_HOST=api.tsyvinda.com
FRONTEND_HOST=https://tsyvinda.com
LETSENCRYPT_EMAIL=your@email.com
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=app
```

### 2. DNS

Add `A` record `api.tsyvinda.com → droplet IP` **before** starting compose — `acme-companion` needs it resolvable to issue the cert.

### 3. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- API (HTTPS): `https://api.tsyvinda.com`
- Swagger: `https://api.tsyvinda.com/docs`

### 4. Common operations

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f app

# restart app only
docker compose -f docker-compose.prod.yml restart app

# deploy new code
git pull
docker compose -f docker-compose.prod.yml up -d --build app

# stop everything
docker compose -f docker-compose.prod.yml down
```

### Basic auth (optional, prod nginx)

Set in `.env`:

```env
BASIC_AUTH=true
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=<strong-password>
```

> Note: credentials are baked into the nginx-proxy image at build time via `htpasswd`. Rebuild after changes: `docker compose -f docker-compose.prod.yml up -d --build nginx-proxy`.

---

## Environment variables

| Variable | Dev default | Required in prod |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | optional |
| `COMPOSE_PROJECT_NAME` | `api-tsyvinda-local` | yes |
| `RESTART_POLICY` | `no` | n/a (prod hardcoded `unless-stopped`) |
| `BACKEND_HOST` | `api.tsyvinda.local` | real domain |
| `FRONTEND_HOST` | `https://tsyvinda.com` | yes (CORS origin) |
| `LETSENCRYPT_EMAIL` | — | yes |
| `POSTGRES_USER` | `postgres` | yes |
| `POSTGRES_PASSWORD` | `postgres` | strong value |
| `POSTGRES_DB` | `app` | yes |
| `DATABASE_URL` | local connection | set automatically in compose |
| `REDIS_URL` | local connection | set automatically in compose |
| `BASIC_AUTH` | `false` | optional |
| `BASIC_AUTH_USERNAME` | `admin` | only if `BASIC_AUTH=true` |
| `BASIC_AUTH_PASSWORD` | `password` | only if `BASIC_AUTH=true` |

`FRONTEND_HOST` is validated at boot — app refuses to start without it.

---

## Database

- TypeORM with Postgres. `synchronize: true` in dev (auto-schema). In prod use migrations.
- Place entities in `src/modules/**/*.entity.ts`. Migrations live in `src/migrations/` (run via `typeorm` CLI; not wired by default).

---

## Health

`GET /health` returns `200` with `{status, db, redis}` if all green, `503` if degraded. The Docker healthcheck pings this endpoint.

---

## Project structure

```
src/
  config/       # app, db, redis, swagger config
  modules/      # feature modules (health, ...)
  app.ts        # express setup
  index.ts      # entrypoint (boot, shutdown)
docker/
  nginx-proxy/  # custom nginx-proxy image (basic auth, config)
.github/workflows/ci.yml   # lint + typecheck + build + test
docker-compose.yml         # dev
docker-compose.prod.yml    # production
Dockerfile                 # multi-stage: development / builder / production
```

---

## Troubleshooting

- **`acme-companion` fails to issue cert** — DNS not propagated yet. Wait, then `docker compose -f docker-compose.prod.yml restart acme-companion`.
- **`https://api.tsyvinda.local` cert untrusted** — run `npm run cert` again; restart `nginx-proxy`.
- **App can't reach Postgres** — check `docker compose ps`; Postgres healthcheck must show `healthy` before app starts (depends_on with `condition: service_healthy`).
- **Rate limit returns 429 unexpectedly** — `trust proxy` is set to `1`; if more proxies sit in front, increase the hop count in `src/app.ts`.
