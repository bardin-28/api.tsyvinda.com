# test-be

Node.js / Express / TypeScript API with Docker support for local dev and production (DigitalOcean).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js 22](https://nodejs.org/) (local dev without Docker only)
- [mkcert](https://github.com/FiloSottile/mkcert) (local HTTPS only)

---

## Environment setup

```bash
cp .env.example .env
# edit .env with your values
```

---

## Development (Docker)

Runs the app with hot-reload via nodemon/tsx. Postgres and Redis included.

```bash
docker compose up --build
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

Stop:

```bash
docker compose down
```

---

## Development (local, no Docker)

Run Postgres and Redis via Docker, app natively:

```bash
docker-compose up -d
npm install
npm run dev
```

---

## Production (DigitalOcean)

### 1. Server setup

```bash
# on the droplet
git clone <repo-url> /app
cd /app
cp .env.example .env
```

Edit `.env` for production:

```env
NODE_ENV=production
COMPOSE_PROJECT_NAME=api-tsyvinda
BACKEND_HOST=api.tsyvinda.com
FRONTEND_HOST=https://tsyvinda.com
LETSENCRYPT_EMAIL=your@email.com
POSTGRES_PASSWORD=<strong-password>
```

### 2. DNS

Add an `A` record pointing `api.tsyvinda.com` → droplet IP before starting — acme-companion needs it to issue the TLS cert.

### 3. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- API (HTTPS): `https://api.tsyvinda.com`
- Swagger: `https://api.tsyvinda.com/docs`

### 4. Useful commands

```bash
# view logs
docker compose -f docker-compose.prod.yml logs -f app

# restart app only
docker compose -f docker-compose.prod.yml restart app

# deploy new code
git pull
docker compose -f docker-compose.prod.yml up -d --build app

# stop everything
docker compose -f docker-compose.prod.yml down
```

---

## Environment variables

| Variable | Dev default | Required in prod |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `PORT` | `3000` | optional |
| `BACKEND_HOST` | `api.tsyvinda.local` | real domain |
| `FRONTEND_HOST` | `https://tsyvinda.com` | yes |
| `LETSENCRYPT_EMAIL` | — | yes |
| `POSTGRES_USER` | `postgres` | yes |
| `POSTGRES_PASSWORD` | `postgres` | strong value |
| `POSTGRES_DB` | `app` | yes |
| `DATABASE_URL` | local connection | set automatically |
| `REDIS_URL` | local connection | set automatically |
| `BASIC_AUTH` | `false` | optional |

---

## Project structure

```
src/
  config/       # app, db, redis, swagger config
  modules/      # feature modules (health, ...)
  app.ts        # express setup
  index.ts      # entrypoint
docker/
  nginx-proxy/  # custom nginx-proxy image (basic auth, config)
docker-compose.yml       # dev
docker-compose.prod.yml  # production
Dockerfile               # multi-stage: development / production
```
