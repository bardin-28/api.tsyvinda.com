# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- Node.js 22 (see `.nvmrc`), TypeScript 5 strict mode
- **NestJS 11 on the Express adapter (`@nestjs/platform-express`)** + Helmet + CORS + `@nestjs/throttler`
- `class-validator` / `class-transformer` for request DTO validation (global `ValidationPipe`)
- TypeORM 0.3 (decorators) on PostgreSQL 18 via `@nestjs/typeorm`
- ioredis on Redis 8 (wrapped as a Nest provider; also backs the throttler)
- `@nestjs/swagger` (decorator-generated OpenAPI) on `/docs`
- React Email templates (`src/emails/*.tsx`) rendered via `@react-email/render`, sent through Resend
- Vitest (node env)

## Commands

| Command                           | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `npm run dev`                     | nodemon + **ts-node** hot-reload                         |
| `npm run build`                   | tsc → `dist/`                                            |
| `npm run typecheck`               | `tsc --noEmit`                                           |
| `npm run lint` / `lint:fix`       | ESLint flat config                                       |
| `npm run format` / `format:check` | Prettier                                                 |
| `npm run test` / `test:watch`     | Vitest                                                   |
| `npm run test:coverage`           | Vitest + v8 coverage                                     |
| `npm run email:dev`               | React-email preview server (`src/emails`, port 3001)     |
| `npm run db:migration:generate` / `run` / `revert` | TypeORM CLI (`-d src/db/database.ts`); `:run:prod` / `:revert:prod` use `dist/` |
| `npm run cert`                    | mkcert TLS pair (reads `BACKEND_HOST` from `.env`)       |

Single test: `npx vitest run path/to/file.test.ts` or `-t "<name>"`.

> **Dev/test run on `ts-node` and SWC, not `tsx`/esbuild.** NestJS DI requires
> `emitDecoratorMetadata` (`design:paramtypes`), which esbuild does not emit. `nodemon`
> runs `ts-node --transpile-only`; Vitest uses the `unplugin-swc` plugin
> (`decoratorMetadata: true`) in `vitest.config.ts`. Do not switch dev/test back to `tsx`.

## Project Layout

```
src/
  index.ts          Boot: NestFactory.create(AppModule) → helmet/cors/cookieParser/pinoHttp via app.use,
                    global filter + ValidationPipe, SwaggerModule, enableShutdownHooks, listen
  app.module.ts     Root module: TypeOrmModule.forRoot + RedisModule + ThrottlerModule (+ global ThrottlerGuard) + feature modules
  db/
    database.ts     dataSourceOptions (shared by TypeOrmModule.forRoot and the migration-CLI AppDataSource)
    migrations/     TypeORM migrations (glob: src/db/migrations/**/*.{ts,js})
  redis/
    redis.ts        ioredis client + error logger
    redis.module.ts Global Nest provider (REDIS token) + onApplicationShutdown quit
  emails/           React-email .tsx templates (Welcome, ConfirmEmail, ResetPassword) — rendered + sent by auth EmailService
  shared/           app.config (env, zod), logger, http-error, all-exceptions.filter, validation-exception.factory,
                    upload-options (multer memoryStorage config for FileInterceptor), dto-transforms,
                    s3/ (S3Service + global S3Module — image uploads to MiniStack/AWS S3),
                    swagger/ (response DTOs), validators/ (@IsMatch), turnstile/ (service + interceptor + constants)
  modules/<name>/   Feature module — see pattern below
```

## Module pattern

Each feature is `src/modules/<name>/`:

- `<name>.controller.ts` — `@Controller('<route>')`, route handlers returning values (or `@Res({ passthrough: true })` when setting cookies)
- `<name>.module.ts` — `@Module` wiring `TypeOrmModule.forFeature([...])`, providers, controllers; imports `AuthModule` to consume `AuthGuard`/`ApprovedGuard`
- `services/<name>.service.ts` — `@Injectable()` business logic; inject `@InjectDataSource()` / `@InjectRepository()`
- `entities/*.entity.ts` — TypeORM entity (glob: `modules/**/*.entity.{ts,js}`)
- `dto/*.dto.ts` — request DTOs (class-validator); `dto/*.response.ts` — `@ApiProperty` response models for Swagger
- `guards/`, `decorators/` (auth module) — `AuthGuard`, `ApprovedGuard`, `@CurrentUser()`

Register the module in `src/app.module.ts` `imports`. See `src/modules/health/` for the canonical small example.

### Request validation

Request input is validated by the global `ValidationPipe` (`transform: true, whitelist: true`)
configured in `src/index.ts` against class-validator DTOs. A custom `exceptionFactory`
(`src/shared/validation-exception.factory.ts`) throws
`HttpError(400, 'VALIDATION_FAILED', ..., { fieldErrors })` so the error body shape is stable.
Cross-field rules (e.g. password confirmation) use the custom `@IsMatch('other')` validator
in `src/shared/validators/`. Coerce query params with `@Type(() => Number)`.

The env config in `src/shared/app.config.ts` still uses `zod`: schema parse at module load,
throws on missing/invalid env. No `@nestjs/config` — failing fast on boot is the contract.

### Errors, auth, rate limit, uploads, turnstile

- **Errors**: one global `AllExceptionsFilter` maps `HttpError`, Nest `HttpException` (incl. 404 → `NOT_FOUND`), `MulterError` (413/400), and unknown → 500, all to `{ error: { code, message, details?, requestId? } }`. `requestId` comes from pino-http's `req.id`.
- **Auth**: `@UseGuards(AuthGuard)` (reads `access` cookie, verifies JWT) and `ApprovedGuard` (DB approval check); read the user with `@CurrentUser()`.
- **Rate limit**: `@nestjs/throttler` + `@nest-lab/throttler-storage-redis`. Global default 100/60s via `ThrottlerGuard`; per-route overrides with `@Throttle({ default: { limit, ttl } })`.
- **File upload**: `FileInterceptor('image', imageUploadMemoryOptions())` (multer **memoryStorage** in `src/shared/upload-options.ts`). The handler streams `file.buffer` to `S3Service.put(key, buffer, mime)` (`posts/<uuid>.<ext>` / `profile/<uuid>.<ext>`) and stores the returned public URL. Old objects are removed via `S3Service.deleteByUrl` in the service layer (no disk, no `CleanupUploadInterceptor`). Local = MiniStack, prod = AWS S3 (see `src/shared/s3/`).
- **Turnstile**: `TurnstileInterceptor`. On multipart routes it MUST be listed **after** `FileInterceptor` (multer populates `req.body` in its interceptor phase, which runs after guards).

## Code Style

- Prettier: 100-char width, single quotes, trailing commas, semicolons, LF
- ESLint flat config (`eslint.config.mjs`); unused vars allowed if prefixed `_`; `@typescript-eslint/no-explicit-any` is **warn**
- TypeScript: decorators on (`experimentalDecorators` + `emitDecoratorMetadata`), `strictPropertyInitialization: false` (TypeORM entities + Nest DI rely on it)
- Swagger docs are `@nestjs/swagger` decorators (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`, `@ApiProperty`, …) on controllers/DTOs — there is no more JSDoc `@openapi` glob

## Environment

- `.env.example` is the template; `.env.local` (dev), `.env.production` (droplet)
- `POSTGRES_PASSWORD` and the password embedded in `DATABASE_URL` must be byte-identical; avoid `@ : / # ?` chars (they break URL parsing — no auto-escape)
- Local HTTPS dev: map `127.0.0.1 <BACKEND_HOST>` in `/etc/hosts`, then `npm run cert`
- `config.isDev` controls TypeORM `synchronize` and `logging` — never enable in prod
- `app.set('trust proxy', 1)` is set for the existing nginx-proxy; revisit if adding Cloudflare in front

## Testing

- Vitest, node env. Test files colocated as `*.test.ts` (root or inside modules).
- HTTP tests boot a Nest app via `@nestjs/testing` (`Test.createTestingModule(...).createNestApplication()`) + supertest; stub guards with `.overrideGuard(...)`, services with `useValue`.
- **New features require Vitest tests.** Cover the controller/service.
- CI runs `build → test` (`.github/workflows/ci.yml`). `format:check`/`lint`/`typecheck` are local-only — run `npm run typecheck && npm test` before pushing.

## Git workflow

- Branch off `main`, open PR, merge after CI green. Don't push directly to `main`.
- Remote: `git@github.com:bardin-28/api.tsyvinda.com.git`.

## Gotchas

- **Decorator metadata toolchain** (see Commands note) — dev/test must stay on ts-node/SWC, never tsx/esbuild, or Nest DI silently injects `undefined`.
- **TurnstileInterceptor ordering** — after `FileInterceptor` on multipart routes.
- `/docs` runs a relaxed Helmet (CSP disabled) only for the `/docs` path so the Swagger init script loads; the global Helmet stays strict. Don't merge them.
- `AppDataSource` in `src/db/database.ts` exists only for the `db:migration:*` CLI; it shares `dataSourceOptions` with `TypeOrmModule.forRoot`. Don't delete it.
- `@nestjs/throttler` sets its own rate-limit response headers (not the old `express-rate-limit` draft-7 headers).
- Use `docker compose` (v2, space), not `docker-compose` (v1, Python, broken on macOS).
- Postgres major-version upgrades require dump/restore (volume data format is version-tied).
- Don't install new packages without confirming first — check `package.json` before adding deps.

## Important Notes

1. **Do not refactor existing models opportunistically.** Change a model only when the current task directly requires it, and explain what changed and why in the phase summary.
2. **Do not install new packages** without asking first. Check `package.json` before suggesting additions.
3. **NDA-affiliated repo** — never include `Co-Authored-By` trailers or mention Anthropic/Claude in commit messages, PR descriptions, or code comments.
