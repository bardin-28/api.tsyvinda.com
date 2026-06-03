# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- Node.js 22 (see `.nvmrc`), TypeScript 5 strict mode
- Express 4 + Helmet + CORS + express-rate-limit
- TypeORM 0.3 (decorators) on PostgreSQL 18
- ioredis on Redis 8
- swagger-jsdoc + swagger-ui-express on `/docs`
- Vitest (node env)

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | nodemon + tsx hot-reload |
| `npm run build` | tsc → `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint flat config |
| `npm run format` / `format:check` | Prettier |
| `npm run test` / `test:watch` | Vitest |
| `npm run cert` | mkcert TLS pair (reads `BACKEND_HOST` from `.env.local`) |

Single test: `npx vitest run path/to/file.test.ts` or `-t "<name>"`.

## Project Layout

```
src/
  app.ts            Express setup (helmet, cors, rate-limit, swagger mount)
  index.ts          Boot: assertConfig → DataSource.initialize → redis.connect → listen + SIGTERM/SIGINT shutdown
  db/
    database.ts     TypeORM DataSource
    migrations/     TypeORM migrations (glob: src/db/migrations/**/*.{ts,js})
  redis/
    redis.ts        ioredis client + error logger
  shared/           app.config (env), logger, swagger, http-error, async-handler, validate, rate-limit, error-handler, not-found
  modules/<name>/   Feature module — see pattern below
```

## Module pattern

Each feature is `src/modules/<name>/` with files named `<name>.<role>.ts`:

- `<name>.routes.ts` — module root router; swagger JSDoc comments live in `<name>.routes.ts` OR `routes/<endpoint>.{ts,js}` (swagger globs: `modules/**/*.routes.{ts,js}` + `modules/**/routes/*.{ts,js}`)
- `<name>.controller.ts` — request handlers, `async (req, res): Promise<void>`
- `<name>.entity.ts` — TypeORM entity (glob: `modules/**/*.entity.{ts,js}`)
- `<name>.service.ts` — business logic (add when controller grows beyond trivial)

Mount in `src/app.ts` with `app.use('/<name>', <name>Router)`. See `src/modules/health/` for the canonical small example.

### Request validation

All request input (body/query/params) is validated with `zod` via the `validate({ body?, query?, params? })` middleware from `src/shared/validate.ts`. Mount it on the route between the router and the controller; it replaces the raw `req.body`/`req.query`/`req.params` with the parsed (and typed) result. On failure it throws `HttpError(400, 'VALIDATION_FAILED', ..., flatten())` which the global error handler formats. Wrap async controllers with `asyncHandler` from `src/shared/async-handler.ts` so thrown errors reach the handler.

The env config in `src/shared/app.config.ts` uses the same `zod` pattern: schema parse at module load, throws on missing/invalid env. No manual `assertConfig` — failing fast on boot is the contract.

## Code Style

- Prettier: 100-char width, single quotes, trailing commas, semicolons, LF
- ESLint flat config (`eslint.config.mjs`); unused vars allowed if prefixed `_`; `@typescript-eslint/no-explicit-any` is **warn** (don't add `any` without reason)
- TypeScript: decorators on (`experimentalDecorators` + `emitDecoratorMetadata`), `strictPropertyInitialization: false` (TypeORM entities don't need `!` on every field)
- Swagger docs are JSDoc `@openapi` blocks above the route — keep them on `.routes.ts` files only (that's where the swagger glob looks)

## Environment

- `.env.example` is the template; `.env.local` (dev), `.env.production` (droplet)
- `POSTGRES_PASSWORD` and the password embedded in `DATABASE_URL` must be byte-identical; avoid `@ : / # ?` chars (they break URL parsing — no auto-escape)
- Local HTTPS dev: map `127.0.0.1 <BACKEND_HOST>` in `/etc/hosts`, then `npm run cert`
- `config.isDev` controls TypeORM `synchronize` and `logging` — never enable in prod
- `app.set('trust proxy', 1)` is set for the existing nginx-proxy; revisit if adding Cloudflare in front

## Testing

- Vitest, node env. Test files colocated as `*.test.ts` (root or inside modules).
- **New features require Vitest tests.** Cover the controller/service; integration tests may hit a real Postgres/Redis (those are exposed on `127.0.0.1` in dev).
- CI runs the chain `format:check → lint → typecheck → build → test` (`.github/workflows/ci.yml`). Run `npm run typecheck && npm test` locally before pushing.

## Git workflow

- Branch off `main`, open PR, merge after CI green. Don't push directly to `main`.
- Remote: `git@github.com:bardin-28/api.tsyvinda.com.git`.

## Gotchas

- Swagger glob must resolve both `.ts` and `.js` — kept that way so dev (tsx) and prod (tsc dist) both work; don't change to single-extension.
- `/docs` mounts a per-route Helmet with `contentSecurityPolicy: false` to allow the Swagger inline init script. Don't merge that exemption into the global Helmet.
- Use `docker compose` (v2, space), not `docker-compose` (v1, Python, broken on macOS).
- Postgres major-version upgrades require dump/restore (volume data format is version-tied).
- Don't install new packages without confirming first — check `package.json` before adding deps.

## Important Notes

1. **Do not refactor existing models opportunistically.** Change a model only when the current task directly requires it, and explain what changed and why in the phase summary.
2. **Do not install new packages** without asking first. Check `package.json` before suggesting additions.
3. **NDA-affiliated repo** — never include `Co-Authored-By` trailers or mention Anthropic/Claude in commit messages, PR descriptions, or code comments.
