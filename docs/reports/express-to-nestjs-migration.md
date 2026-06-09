# Report: Express.js → NestJS migration

Plan: `docs/plans/express-to-nestjs-migration.md`. Full framework rewrite from hand-rolled
Express 4 to **NestJS 11 on the Express adapter (`@nestjs/platform-express`)**, maximizing
Nest-native features. Business logic (entities, services, crypto/token/email, migrations)
reused verbatim; only the transport/wiring layer was rebuilt. All HTTP contracts preserved
(routes, status codes, error shape, cookies, uploads, Turnstile) with one deliberate change
(rate-limit response headers — see Deviations).

## Phase summaries

### Phase 0 — Dependencies & toolchain

- Added runtime: `@nestjs/{common,core,platform-express,typeorm,swagger,throttler}`,
  `@nest-lab/throttler-storage-redis`, `rxjs`, `class-validator`, `class-transformer`.
  Dev: `@nestjs/testing`, `@swc/core`, `unplugin-swc`.
- **Toolchain swap (critical):** Nest DI needs `emitDecoratorMetadata`. `tsx`/esbuild (old
  dev + Vitest transform) do not emit it. Switched `nodemon` to `ts-node --transpile-only`
  and registered `unplugin-swc` (`decoratorMetadata: true`) in `vitest.config.ts`. Verified
  type-based injection resolves under Vitest+SWC.

### Phase 1 — Core infrastructure & Health

- `src/index.ts` Nest bootstrap (`NestExpressApplication`): pino-http (x-request-id
  echo/gen + customLogLevel), helmet (relaxed on `/docs`), `enableCors` (allow-list +
  `CORS_DENIED`), cookie-parser, `useBodyParser('json', 1mb)`, `useStaticAssets`
  (`/uploads/*` + CORP/cache headers), global filter + ValidationPipe, `enableShutdownHooks`,
  10s force-exit watchdog.
- `AllExceptionsFilter` reproduces the old `error-handler` + `not-found` body shape
  (HttpError / HttpException / MulterError / unknown).
- `RedisModule` (global provider + shutdown quit), `dataSourceOptions` shared with the
  migration CLI, `validationExceptionFactory` (zod-flatten-shaped `VALIDATION_FAILED`).
- `HealthController`/`HealthModule`; `app.test.ts` ported to Nest.

### Phase 2 — Shared cross-cutting primitives

`AuthGuard`, `ApprovedGuard`, `@CurrentUser()`, `TurnstileInterceptor` (after-FileInterceptor
ordering documented), `CleanupUploadInterceptor`, `imageUploadOptions` factory, `@IsMatch`.
All logic ported from the old middleware. Unit tests for each.

### Phase 3 — Auth module

- `AuthService`/`EmailService` made `@Injectable` (logic verbatim). `EmailService` provided
  via `useFactory` (primitive `apiKey` ctor param Nest DI can't resolve). `token`/`crypto`
  kept as pure functions.
- DTOs (class-validator) replace `auth.schema.ts`; email trim/lowercase via `@Transform`,
  password rules via `@Matches`, confirmation via `@IsMatch`.
- `AuthController` (7 routes) — exact contracts incl. cookies via `@Res({ passthrough })`.
  Turnstile on register/login/forgot/reset. Per-route `@Throttle`.
- Rate limiting moved to `@nestjs/throttler` (global 100/60s `ThrottlerGuard` + Redis storage).

### Phase 4 — Users (profile) & Posts

- `ProfileService`/`PostService` `@Injectable` (logic verbatim).
- `UsersController` (`/profile`) + `PostsController` (`/posts`, full CRUD). `FileInterceptor`
  → `CleanupUploadInterceptor` → (`TurnstileInterceptor` on profile) ordering. DTOs replace
  the zod schemas. Modules import `AuthModule` for the guards.

### Phase 5 — Swagger finalization & legacy removal

- `DocumentBuilder` + `SwaggerModule.setup('/docs')` (+ `addCookieAuth`). Response DTO
  classes (`ErrorDto`, `UserDto`, `AuthLoginResponseDto`, `PostDto`, `PostListDto`,
  `PostAuthorDto`); controllers annotated.
- Deleted 11 dead Express files (validate, async-handler, not-found, error-handler, swagger,
  rate-limit, cleanup-upload, 3 `*.schema.ts`). Slimmed both `upload.ts` to constants.
- Pruned deps (−30 pkgs): `swagger-jsdoc`, `swagger-ui-express` (+types),
  `express-rate-limit`, `rate-limit-redis`.

### Phase 6 — Green CI chain

Full chain green: `format:check ✅ · lint ✅ · typecheck ✅ · build ✅ · test ✅`
(**107 tests / 17 suites**). Pre-existing prettier-3.8.3 drift on 13 files (failed on `main`
too) cleared repo-wide with `npm run format` at the user's request.

### Phase 7 — Verification & docs

- Runtime DI verified: the built `dist/index.js` boots, resolves the entire `AppModule` DI
  graph, and proceeds to the TypeORM connect step (a broken graph would crash
  `NestFactory.create` immediately).
- `CLAUDE.md` rewritten for the NestJS reality; this report written.

## Verification status

| Check                                                                | Status                            |
| -------------------------------------------------------------------- | --------------------------------- |
| `format:check` / `lint` / `typecheck` / `build`                      | ✅                                |
| `test` (107 / 17 suites)                                             | ✅                                |
| Full `AppModule` DI graph resolves at runtime                        | ✅ (dist boot reaches DB connect) |
| Live HTTP flows, cookies, uploads, Turnstile, static, `/docs` render | ⏳ needs Postgres+Redis           |
| Docker `development` (ts-node) + `production` (tsc) boot             | ⏳ needs Docker daemon            |

### Deferred E2E — run in an infra-equipped environment

```bash
docker compose up -d postgres redis        # or point .env.local at running services
npm run db:migration:run                   # apply migrations
npm run dev                                 # boot; then exercise:
#   register → confirm-email → login → refresh → GET/PATCH /profile →
#   POST/PATCH/DELETE /posts (with/without image) → logout
#   GET /health, GET /docs (Swagger UI renders), GET /uploads/<file>
#   Turnstile dev-skip (no secret) + bypass-token path; throttler 429 after limit
docker compose build && docker compose up   # verify dev (ts-node) + prod (node dist) stages
```

## Deviations from a byte-for-byte port

- **Rate-limit response headers** changed: `express-rate-limit` draft-7 headers →
  `@nestjs/throttler` headers. Limits/windows preserved (100/60s global; login/register/reset
  10, forgot 5). Accepted for "max Nest".
- Kept `src/shared/app.config.ts` (zod) instead of `@nestjs/config` — preserves the project's
  fail-fast-on-boot env contract.
- Single `AuthController` (Nest idiom) rather than per-endpoint subfolders.
- `helmet` / `cookie-parser` / `pino-http` remain as `app.use(...)` Express middleware — the
  idiomatic Nest path where no native API exists.

## Notes

- `AppDataSource` retained solely for the `db:migration:*` CLI (shares `dataSourceOptions`).
- No opportunistic model changes — entities, migrations, and service logic are unchanged.
