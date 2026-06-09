# Plan: Migrate Express.js → NestJS (full rewrite)

## Goal

Replace the hand-rolled Express 4 framework layer with NestJS on the **default
`@nestjs/platform-express` adapter**, using **maximum Nest-native functionality** for every
concern that Nest provides first-class (DI, modules, controllers, guards, interceptors,
pipes, exception filters, `@nestjs/swagger`, `@nestjs/throttler`, `FileInterceptor`,
`enableCors`, `useStaticAssets`, lifecycle/shutdown hooks). Plain Express is used **only**
where Nest has no native equivalent — and there the standard Nest pattern is itself
`app.use(<express-middleware>)` (helmet, cookie-parser, pino-http). All existing HTTP
contracts are preserved byte-for-byte: routes, status codes, error payload shape
(`{ error: { code, message, details?, requestId? } }`), cookies, rate limits, Turnstile
behavior, file uploads, Swagger `/docs`. Business logic (TypeORM entities, services,
crypto/token/email, migrations) is reused unchanged; only the transport/wiring layer is
rebuilt the Nest way.

---

## Requirements

_Captured from the user's decisions:_

- **Full big-bang** — all 4 modules (`health`, `auth`, `users`, `posts`) + bootstrap +
  config + swagger migrated on one branch.
- **NestJS on platform-express (NOT Fastify).** Prefer Nest-native features; fall back to
  Express middleware only where Nest offers nothing native.
- **Switch validation to class-validator** — zod request schemas become class DTOs validated
  by the global `ValidationPipe`. (zod stays only for env config — see below.)
- **`@nestjs/swagger` decorators** — drop `swagger-jsdoc` + the hand-written spec; generate
  OpenAPI from controller/DTO decorators. Served at `/docs`, cookie auth (`access`) preserved.
- Preserve all non-functional contracts: error shape, `x-request-id`, graceful shutdown,
  CORS allow-list, helmet, per-route rate limits, Turnstile (incl. bypass token), upload
  cleanup, static `/uploads/*` serving with CORP + cache headers.
- New code requires Vitest tests; keep the full CI chain green
  (`format:check → lint → typecheck → build → test`).

---

## Nest-native vs Express fallback (the mapping)

| Concern                            | Implementation                                                                   | Native Nest?                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| App/adapter                        | `NestExpressApplication` (`@nestjs/platform-express`)                            | ✅                                                             |
| Routing                            | `@Controller` / `@Get/@Post/...`                                                 | ✅                                                             |
| DI / services                      | `@Injectable`, `@InjectRepository`, `DataSource`                                 | ✅                                                             |
| ORM                                | `TypeOrmModule.forRoot/forFeature`                                               | ✅                                                             |
| Validation                         | global `ValidationPipe` + class-validator DTOs                                   | ✅                                                             |
| Errors / 404                       | global `AllExceptionsFilter` (+ Nest `NotFoundException`)                        | ✅                                                             |
| Auth / approval                    | `AuthGuard` / `ApprovedGuard` + `@CurrentUser()`                                 | ✅                                                             |
| Rate limiting                      | `@nestjs/throttler` + `@nest-lab/throttler-storage-redis`, per-route `@Throttle` | ✅                                                             |
| File upload                        | `FileInterceptor` (`@nestjs/platform-express`, multer under the hood)            | ✅                                                             |
| Upload cleanup                     | `CleanupUploadInterceptor`                                                       | ✅                                                             |
| Turnstile                          | `TurnstileInterceptor` (after `FileInterceptor` on multipart)                    | ✅                                                             |
| CORS                               | `app.enableCors(...)`                                                            | ✅                                                             |
| Static files                       | `app.useStaticAssets(...)` (NestExpress built-in)                                | ✅                                                             |
| Swagger                            | `@nestjs/swagger` `SwaggerModule`                                                | ✅                                                             |
| Shutdown                           | `app.enableShutdownHooks()` + module `onApplicationShutdown`                     | ✅                                                             |
| Body limit                         | `app.useBodyParser('json', { limit: '1mb' })`                                    | ✅                                                             |
| **Helmet**                         | `app.use(helmet())`                                                              | ⚠️ Express middleware (no native Nest API)                     |
| **Cookie parsing**                 | `app.use(cookieParser())`                                                        | ⚠️ Express middleware                                          |
| **Request logging / x-request-id** | `app.use(pinoHttp({...}))` reusing existing pino + `genReqId`                    | ⚠️ Express middleware (keeps structured pino logs + redaction) |

> The three ⚠️ rows are the documented, idiomatic Nest way to use Express middleware
> (`app.use(...)`); they are not a deviation from "max Nest". Redis is wrapped as a Nest
> provider regardless.

---

## Architectural decisions

- **`NestExpressApplication`** via `NestFactory.create<NestExpressApplication>(AppModule)`.
  Enables `useStaticAssets`, `useBodyParser`, and `app.use(...)` for the three Express
  middlewares above.

- **Decorator-metadata toolchain swap (DONE in Phase 0).** Nest DI needs
  `emitDecoratorMetadata` (`design:paramtypes`). `tsc` build already emits it; `tsx` (dev)
  and Vitest's esbuild do not. Dev `nodemon` now runs `ts-node --transpile-only`; Vitest
  uses the `unplugin-swc` plugin with `decoratorMetadata: true`.

- **Keep `src/shared/app.config.ts` (zod) — do NOT adopt `@nestjs/config`.** The project's
  established contract (CLAUDE.md) is "schema parse at module load, fail fast on boot, no
  manual assertConfig". The existing zod loader already does exactly that and is
  framework-agnostic (not Express-coupled). Forcing `ConfigService.get()` everywhere would
  be churn for no contract gain. Providers/`main` import the typed `config` object directly.
  (Considered and rejected on purpose.)

- **Keep `src/db/database.ts` `AppDataSource`** for the `db:migration:*` CLI; extract a
  shared `dataSourceOptions` object that both the CLI DataSource and `TypeOrmModule.forRoot`
  consume so they never drift. Per-module entities via `TypeOrmModule.forFeature`; repos via
  `@InjectRepository`.

- **Redis as a global Nest provider** (`RedisModule`) wrapping the existing ioredis client
  behind a `REDIS` token, with `onApplicationShutdown → quit()`. Consumed by the health
  check and the throttler storage.

- **Rate limiting → `@nestjs/throttler`** (Nest-native) with `@nest-lab/throttler-storage-redis`,
  replacing `express-rate-limit` + `rate-limit-redis`. Global default 100/60s; per-route
  overrides via `@Throttle` (login/register 10/60s, forgot-password 5/60s, reset 10/60s).
  Note: throttler emits its own headers/semantics (sliding window) — a deliberate, accepted
  change vs the old `draft-7` headers. `src/shared/rate-limit.ts` is removed.

- **Errors → one global `AllExceptionsFilter`** reproducing `error-handler.ts` + `not-found.ts`
  exactly: maps our `HttpError` (kept), Nest `HttpException` (incl. 404 → `NOT_FOUND` with the
  old `Route <M> <url> not found` message), `MulterError` (413/400), and unknown → 500, all to
  `{ error: { code, message, details?, requestId? } }`. `requestId` comes from `req.id`
  (set by pino-http). The global `ValidationPipe` uses a custom `exceptionFactory` that throws
  `HttpError(400, 'VALIDATION_FAILED', ...)` with a zod-`flatten()`-shaped `details` payload.

- **Auth → guards + param decorator.** `is-authenticated.ts` → `AuthGuard`;
  `requires-approval.ts` → `ApprovedGuard` (runs after `AuthGuard`); `@CurrentUser()` replaces
  every `if (!req.user) throw` block (the guard guarantees presence).

- **Turnstile → `TurnstileInterceptor`** (not a guard). For JSON routes the body is parsed
  before the interceptor; for the multipart profile PATCH the token only exists after
  `FileInterceptor` (multer) runs, so the interceptor is placed **after** `FileInterceptor` in
  the chain. Logic ported verbatim from `turnstile.middleware.ts`; `turnstile.service.ts` +
  `constants.ts` reused unchanged.

- **Uploads → `FileInterceptor('image', { storage, limits, fileFilter })`** built from the
  existing multer configs in `posts/shared/upload.ts` and `users/shared/upload.ts`. The
  `cleanup-upload.ts` unlink-on-error logic becomes `CleanupUploadInterceptor`. `MulterError`
  → `HttpError` mapping moves into the global filter.

- **DTOs replace zod schemas** via class-validator: email `trim/lowercase` → `@Transform`;
  password complexity → `@Matches`; **cross-field password match** → custom `@IsMatch('password')`
  constraint; query coercion (`limit`, default 20) → `@Type(() => Number)` under
  `ValidationPipe({ transform: true })`; `removeImage: 'true'` → `@IsIn(['true'])`.

- **Swagger from decorators** — `DocumentBuilder` (+ `addCookieAuth('access')`),
  `SwaggerModule.setup('/docs')`. Shared schemas become decorated DTO classes; per-route docs
  become `@ApiOperation/@ApiResponse/@ApiTags/@ApiBody/@ApiConsumes`. The `/docs` Helmet CSP
  exemption is reproduced by skipping/relaxing `helmet` CSP for the `/docs` path.

---

## Dependencies

**Already installed (Phase 0):** `@nestjs/{common,core,platform-express,typeorm,swagger,throttler}`,
`@nest-lab/throttler-storage-redis`, `rxjs`, `class-validator`, `class-transformer`;
dev: `@nestjs/testing`, `@swc/core`, `unplugin-swc`. (`reflect-metadata` already present.)

**Retained Express deps (used via `app.use` / FileInterceptor):** `express`, `helmet`,
`cookie-parser`, `multer`, `pino-http`.

**Removed at the end (Phase 5):** `swagger-jsdoc`, `swagger-ui-express`,
`@types/swagger-jsdoc`, `@types/swagger-ui-express` (→ `@nestjs/swagger`);
`express-rate-limit`, `rate-limit-redis` (→ `@nestjs/throttler`); `cors` if `enableCors`
needs no standalone import; `tsx` if no script references it. `zod` stays (env config).

---

## Implementation Checklist

### ☑ Phase 0 — Dependencies & toolchain (DONE)

- **Step 1** — Nest + class-validator/transformer + throttler + redis-storage installed;
  dev: `@nestjs/testing`, `@swc/core`, `unplugin-swc`.
- **Step 2** — `tsconfig.json` verified (`commonjs`, `experimentalDecorators`,
  `emitDecoratorMetadata` all on).
- **Step 3** — `nodemonConfig.exec` → `ts-node --transpile-only src/index.ts`.
- **Step 4** — `vitest.config.ts` registers `unplugin-swc` with decorator metadata.

### ☑ Phase 1 — Core infrastructure & Health module (DONE, platform-express)

> Note: `ThrottlerModule` wiring (step 5) was deferred to Phase 3, where the first
> rate-limited routes (auth) actually need it — health needs no throttling, so adding it
> here would be dead config. AppModule currently wires TypeOrm + Redis + Health only.

- **Step 1** — `dataSourceOptions` extracted in `src/db/database.ts` (DONE).
- **Step 2** — `RedisModule` global provider + shutdown quit (DONE).
- **Step 3** — `AllExceptionsFilter` for **Express** (`@Catch()`, express `Request`/`Response`,
  `req.id` from pino-http, HttpError/HttpException/MulterError/unknown).
- **Step 4** — `src/index.ts` bootstrap: `NestExpressApplication`; `app.use(pinoHttp({...}))`
  with the exact `genReqId` (x-request-id echo/generate) + `customLogLevel`; `app.use(helmet())`
  (relaxed/skipped on `/docs`); `app.enableCors(...)` (allow-list + `HttpError(403,'CORS_DENIED')`);
  `app.use(cookieParser())`; `app.useBodyParser('json', { limit: '1mb' })`;
  `app.useStaticAssets(...)` for `/uploads/profile` + `/uploads/posts` with CORP + cache
  headers; `app.set('trust proxy', 1)`; `app.disable('x-powered-by')`; global filter; global
  `ValidationPipe`; `app.enableShutdownHooks()`; listen on `config.port`; SIGTERM/SIGINT
  force-exit watchdog (10s).
- **Step 5** — `AppModule` wiring `TypeOrmModule.forRoot(dataSourceOptions)`, `RedisModule`,
  `ThrottlerModule.forRootAsync(redis storage)` + global `ThrottlerGuard`, `HealthModule`.
- **Step 6** — `HealthModule` + `HealthController` (`GET /health`) ported (DONE, express-ify
  the `@Res` reply type).
- **Step 7** — Port health + 404 tests onto a Nest **express** `Test` app + supertest; verify
  `x-request-id` echo/generate and `NOT_FOUND` shape. **Stop for review.**

### ☑ Phase 2 — Shared Nest cross-cutting primitives (DONE)

`AuthGuard`, `ApprovedGuard`, `@CurrentUser()`, `TurnstileInterceptor`,
`CleanupUploadInterceptor`, `FileInterceptor` upload option factories (from existing multer
configs), custom `@IsMatch` validator + shared transforms. Unit-test each. **Stop for review.**

### ☑ Phase 3 — Auth module (DONE)

Services → `@Injectable` (`@InjectRepository` + `DataSource`); DTOs replace `auth.schema.ts`
(+ `@IsMatch`); `AuthController` (register/login/refresh/logout/confirm-email/forgot/reset)
with cookie helpers on express `Response`, `TurnstileInterceptor` + per-route `@Throttle`;
`@nestjs/swagger` decorators; `AuthModule` exporting guards. Port auth service + (new Nest)
route tests. **Stop for review.**

### ☑ Phase 4 — Users (profile) & Posts modules (DONE)

`ProfileService`/`PostService` `@Injectable`; controllers with `AuthGuard`(+`ApprovedGuard`),
`FileInterceptor` → `CleanupUploadInterceptor` → `TurnstileInterceptor` ordering on profile
PATCH; DTOs replace `*.schema.ts`; full posts CRUD; Swagger. Mount `/profile` + `/posts`.
Port module tests. **Stop for review.**

### ☑ Phase 5 — Swagger finalization & legacy removal (DONE)

> Live `/docs` render verified in Phase 7 (needs a DB-connected boot); Phase 5 gate is
> typecheck + tests green + decorators valid.

`DocumentBuilder` + `SwaggerModule.setup('/docs')` (+ cookieAuth, CSP exemption); response
DTO classes for shared schemas; delete dead Express scaffolding (`*.routes.ts`, `routes/*.ts`,
`validate.ts`, `async-handler.ts`, `not-found.ts`, `error-handler.ts`, `swagger.ts`,
`rate-limit.ts`, `*.schema.ts`, `middleware/*.ts`); remove dead deps
(`swagger-jsdoc`, `swagger-ui-express`, `express-rate-limit`, `rate-limit-redis`, +types).
Keep `http-error.ts`, `logger.ts`, `app.config.ts`, `cleanup`/`turnstile` service+constants.
`typecheck` clean. **Stop for review.**

### ☑ Phase 6 — Test suite migration & green CI chain (DONE)

> Pre-existing prettier-3.8.3 drift on 13 files (3 backend src + docs/.claude) — which failed
> on `main` too — was formatted repo-wide (`npm run format`) at the user's request so the full
> chain is green. Note `.claude/skills/backend-developer/SKILL.md` and `CLAUDE.md` were among
> them; CLAUDE.md content is still stale (Express) and is rewritten in Phase 7.

All specs on Nest express `Test` app + supertest / direct instantiation with mocks. Full
chain green: `format:check → lint → typecheck → build → test`. Add tests for new Nest
primitives. **Stop for review.**

### ☑ Phase 7 — E2E verification, docs & report (DONE)

E2E flow (register→confirm→login→refresh→profile→post CRUD→logout, `/health`, `/docs`,
`/uploads/*`, Turnstile dev-skip + bypass, rate-limit). Verify Docker dev (`ts-node`) +
prod (`tsc` → `node dist/index.js`) stages boot. Update `CLAUDE.md` (Stack, module pattern,
gotchas: decorator-metadata toolchain, Turnstile interceptor ordering, `/docs` CSP,
throttler header change). Write `docs/reports/express-to-nestjs-migration.md`. **Stop for review.**

---

## Important Notes

- **Contract preservation is the acceptance bar.** One deliberate exception: rate-limit
  response headers change (`express-rate-limit` draft-7 → `@nestjs/throttler`); behavior
  (limits/windows) is matched. Flagged for sign-off.
- **Decorator metadata is the #1 risk** — Phase 0 toolchain (`ts-node` dev, SWC for Vitest)
  must hold; broken metadata = silent `undefined` injected deps at runtime, not a compile error.
- **Turnstile interceptor ordering** with `FileInterceptor` on the multipart profile route is
  subtle; covered by a test.
- **`AppDataSource` stays** for the migration CLI — shares one options object with the Nest module.
- **No opportunistic model changes** (CLAUDE.md) — entities/migrations/service logic ported verbatim.
- **NDA repo** — no `Co-Authored-By` / Anthropic mentions in commits or PRs. Skill does not
  commit; user reviews each phase.
- **Big-bang interim:** the three old `*.routes.test.ts` were removed (they imported the
  deleted Express `app.ts`); they are restored as Nest tests in Phases 3–4.
