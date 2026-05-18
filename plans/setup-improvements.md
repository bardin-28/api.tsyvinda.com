# Plan: Project Setup Improvements (INTERNAL-SETUP-001)

## Goal

Harden the backend boilerplate (Express 4 + TypeORM + ioredis) for production: fix shutdown/error/logging gaps, add input validation, move rate-limit state to Redis, tighten tooling, and polish Docker/Swagger. The codebase is small (only `health` module + bootstrap), so the work is purely cross-cutting infrastructure — no business logic touched.

---

## Requirements

- Preserve current module pattern (`src/modules/<name>/<name>.<role>.ts`) and CLAUDE.md conventions.
- No new feature packages without explicit approval — every new dep listed below in **Architectural decisions** must be confirmed before install.
- Keep CI chain `format:check → lint → typecheck → build → test` green at the end of every phase.
- No breaking change to `/health` response shape (used by Docker healthcheck on `Dockerfile:25-26` and `docker-compose.yml:63`).
- Logger output must stay human-readable in dev and JSON in prod.
  - All changes must be reviewable phase-by-phase — stop after each phase for developer review before continuing.

---

## Architectural decisions

- **Logger: `pino` + `pino-http`** — Lightweight, JSON-native, fastest Node logger. `pino-pretty` for dev only (devDependency). Replaces all `console.log` in `index.ts`, `health.controller.ts`. Needs npm install confirmation.
- **Request ID: `pino-http` built-in `genReqId`** — Reuses `x-request-id` header if upstream nginx sets it, otherwise generates UUID. Avoids extra `uuid` dep.
- **Validation: `zod`** — Used both for (a) request body/query/params via a thin `validate(schema)` middleware and (b) env schema in `app.config.ts` to replace the manual `assertConfig`. Needs npm install confirmation.
- **Rate-limit store: `rate-limit-redis` + existing `ioredis` client** — Reuses the already-connected `redis` instance from `src/config/redis.ts`. No new Redis connection. Needs npm install confirmation.
- **Async handler: tiny in-repo helper** — A single `asyncHandler<H extends RequestHandler>(fn): RequestHandler` in `src/shared/async-handler.ts`. No new dep (`express-async-errors` would patch globals — avoid).
- **Global error middleware** — `src/shared/error-handler.ts` formats all errors to `{ error: { code, message, requestId } }`. Maps `ZodError` → 400, `HttpError` (in-repo class) → status, everything else → 500 + log `err`.
- **Husky + lint-staged** — Pre-commit runs `lint-staged` (Prettier + ESLint on staged files). Needs npm install confirmation. `prepare` script wires husky install.
- **Supertest** — Devdep for integration tests against the Express app (no listen). Needs npm install confirmation.
- **Vitest coverage** — Use built-in `@vitest/coverage-v8` (already shipped with vitest 2.x? — verify on phase 5). Coverage threshold left unset initially; just emit reports.
- **TypeORM migration scripts** — Add `db:migration:generate`, `db:migration:run`, `db:migration:revert` driven by `typeorm-ts-node-commonjs` (already pulled by `typeorm`). No new dep.
- **Tsconfig tighten** — Add `noUncheckedIndexedAccess: true`. Keep `strictPropertyInitialization: false` (TypeORM entity requirement per CLAUDE.md).
- **ESLint globals fix** — Add `globals` devdep and spread `globals.node` instead of malformed `{ node: true }`. Needs npm install confirmation.
- **CORS multi-origin** — Allow comma-separated `FRONTEND_HOST` parsed into array; reject when origin not in list. Keep `origin: false` when env empty (dev/no-frontend).
- **Dockerfile layer cache** — Split the development stage so `npm install` runs before `COPY . .`. Builder stage already correct.
- **Swagger error schema** — Reusable `components.schemas.Error` mirroring the global error middleware output, referenced from route JSDoc.

## Implementation Checklist

### ✅ Phase 1 — Stability & error handling

- **Step 1** — Add `src/shared/async-handler.ts` exporting `asyncHandler`.
- **Step 2** — Add `src/shared/http-error.ts` with `HttpError extends Error { status, code }`.
- **Step 3** — Add `src/shared/error-handler.ts` (global 4-arg middleware) + `src/shared/not-found.ts` (404 handler).
- **Step 4** — Wire `notFound` and `errorHandler` at the end of `src/app.ts`. Order: `/health` → `notFound` → `errorHandler`.
- **Step 5** — In `src/config/redis.ts`, attach `redis.on('error', (err) => logger.error({ err }, 'redis error'))`.
- **Step 6** — In `src/index.ts`, await `server.close()` via `new Promise<void>((resolve) => server.close(() => resolve()))`; add 10s force-exit timer; await `redis.quit()` instead of `disconnect()` so in-flight commands drain.
- **Step 7** — In `src/modules/health/health.controller.ts`, replace empty `catch {}` with `catch (err) { logger.warn({ err }, 'health: db check failed') }` (logger added in Phase 2 — until then, use `console.warn`; replace in Phase 2).
- **Step 8** — Relax `assertConfig`: `FRONTEND_HOST` no longer required, only `DATABASE_URL`. CORS handles empty case via `origin: false`.
- **Step 9** — Vitest: add `src/shared/error-handler.test.ts` (mounts `errorHandler` on a stub app, asserts JSON shape + status mapping).

### ⬜ Phase 2 — Observability

- **Step 1** — Confirm install: `pino`, `pino-http`. Dev: `pino-pretty`.
- **Step 2** — Add `src/config/logger.ts` exporting `logger`. Dev: `pino-pretty` transport, level `debug`. Prod: JSON, level `info`. Redact `req.headers.authorization`, `req.headers.cookie`.
- **Step 3** — Add `pino-http` middleware to `src/app.ts` (before routes). Configure `genReqId` to honor `x-request-id`.
- **Step 4** — Replace all `console.*` in `src/index.ts` and `src/modules/health/health.controller.ts` with `logger`.
- **Step 5** — Error handler logs at `error` level with the request-bound logger (`req.log`); include `requestId` in response body.
- **Step 6** — Update `/health` JSDoc to document `x-request-id` response header.

### ⬜ Phase 3 — Validation

- **Step 1** — Confirm install: `zod`.
- **Step 2** — Add `src/shared/validate.ts`: `validate({ body?, query?, params? })` middleware returning a `RequestHandler`. On `ZodError`, call `next(new HttpError(400, 'VALIDATION_FAILED', ...))`.
- **Step 3** — Convert `src/config/app.config.ts` to a `zod` schema. `config` becomes the parsed result. Throw with `z.ZodError.format()` output on boot if invalid. Remove the manual `assertConfig` function (replaced by schema parse at module load).
- **Step 4** — Add NaN guard for `PORT` via `z.coerce.number().int().positive().default(3000)`.
- **Step 5** — Document the validation pattern in CLAUDE.md (one paragraph under "Module pattern").
- **Step 6** — Vitest: schema unit test for env config (happy + missing `DATABASE_URL`).

### ⬜ Phase 4 — Rate-limit Redis store

- **Step 1** — Confirm install: `rate-limit-redis`.
- **Step 2** — In `src/app.ts`, replace inline rate-limit with `src/shared/rate-limit.ts` factory using `rate-limit-redis` and the shared `redis` instance.
- **Step 3** — Ensure rate-limit is mounted **after** redis connects (it is — `app` is created at module load but the middleware just calls `redis.sendCommand`, which queues until ready since `lazyConnect: true`).
- **Step 4** — Update README rate-limit section if present.
- **Step 5** — Vitest: integration test (supertest, added in Phase 5) deferred to Phase 5 final pass.

### ⬜ Phase 5 — Tooling

- **Step 1** — Confirm install: `husky`, `lint-staged`, `supertest`, `@types/supertest`, `globals`, `@vitest/coverage-v8`.
- **Step 2** — Add `prepare` script: `husky`. Add `.husky/pre-commit` running `npx lint-staged`.
- **Step 3** — Add `lint-staged` config to `package.json`: `*.ts → eslint --fix`, `*.{ts,json,md} → prettier --write`.
- **Step 4** — Fix `eslint.config.mjs`: `import globals from 'globals'; ... globals: { ...globals.node }`.
- **Step 5** — Tighten `tsconfig.json`: add `"noUncheckedIndexedAccess": true`. Run `npm run typecheck`; fix any breakage (likely small — env access patterns).
- **Step 6** — Add npm scripts:
  - `db:migration:generate`: `typeorm-ts-node-commonjs migration:generate -d src/config/database.ts`
  - `db:migration:run`: `typeorm-ts-node-commonjs migration:run -d src/config/database.ts`
  - `db:migration:revert`: `typeorm-ts-node-commonjs migration:revert -d src/config/database.ts`
- **Step 7** — Add `vitest.config.ts` coverage block (`coverage: { provider: 'v8', reporter: ['text', 'lcov'], exclude: ['dist/**', '**/*.test.ts'] }`).
- **Step 8** — Replace `src/app.test.ts` sanity test with a supertest scaffold hitting `/health` (mock `AppDataSource`/`redis`).
- **Step 9** — Re-run full CI chain locally: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test`.

### ⬜ Phase 6 — Polish

- **Step 1** — `src/app.ts` CORS: parse `config.frontendHost` as `string[]` (comma-separated). Function-form `origin` callback checking inclusion.
- **Step 2** — `src/config/swagger.ts`: add `components.schemas.Error` matching error middleware payload. Add default 4xx/5xx response refs in JSDoc on `/health`.
- **Step 3** — `Dockerfile` `development` stage: split `npm install` step from `COPY . .` so source edits don't bust install layer. (`builder` stage already optimal.)
- **Step 4** — `app.config.ts` schema: support `FRONTEND_HOST` as comma-separated list (`z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))`).
- **Step 5** — Update `.env.example` comment to document comma-separated `FRONTEND_HOST`.
- **Step 6** — End-to-end review: re-read every changed file, run full CI chain, propose follow-ups.

---

## Important Notes

- **Install gating** — Each phase that lists `Confirm install:` must pause and ask the developer to approve `package.json` additions before running `npm install`. Per CLAUDE.md: "Don't install new packages without confirming first".
- **No business logic change** — The codebase has only `health` as a real module; this plan touches only cross-cutting wiring. Do not rewrite the health module beyond logger replacement and the empty-catch fix.
- **Synchronize order** — Phase 1 introduces `src/shared/*` files that the rest of the plan depends on. Do not skip ahead.
- **Migrations dir missing** — `src/migrations/` does not exist yet. Phase 5 Step 6 only adds the scripts; the directory will be created by the first `migration:generate` invocation.
- **/health contract** — Response keys (`status`, `db`, `redis`) and 200/503 mapping must remain unchanged through every phase. Docker healthcheck depends on the 200 status only.
- **trust proxy** — `app.set('trust proxy', 1)` stays. Phase 4 rate-limit Redis store relies on `req.ip` being the real client IP via the proxy.

---

## Post-implementation follow-ups (out of scope for this plan)

- Authentication / authorization middleware (no auth module exists yet).
- OpenTelemetry tracing.
- Per-route rate-limit tiers.
- Pagination/list-response standardization helper.
