# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

pnpm 12 + Turborepo monorepo:

| Workspace                                            | What                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/api`                                           | NestJS API (everything below) — `@tsyvinda/api`                                                               |
| `apps/admin`                                         | Admin panel: React-Admin 5 · MUI 9 · Vite, served at `/` of `ADMIN_HOST` — `@tsyvinda/admin`                  |
| `packages/shared-types`                              | Types shared by api + admin (`User`, `Role`, `AuthSession`, `DashboardStats`, `ApiErrorBody`, CMS `content/`) |
| `packages/eslint-config`, `packages/prettier-config` | Shared lint/format config (root `eslint.config.mjs` adds node/browser globals)                                |

API stack:

- Node.js 24 (see `.nvmrc`), TypeScript strict mode
- **NestJS 12 on the Express adapter (`@nestjs/platform-express`)** + Helmet + CORS + `@nestjs/throttler`
- `class-validator` / `class-transformer` for request DTO validation (global `ValidationPipe`)
- TypeORM 0.3 (decorators) on PostgreSQL 18 via `@nestjs/typeorm`
- ioredis on Redis 8 (wrapped as a Nest provider; also backs the throttler)
- `@nestjs/swagger` (decorator-generated OpenAPI) on `/docs` — off in production unless `SWAGGER_ENABLED=true`
- React Email templates (`src/emails/*.tsx`) (components from `react-email`) rendered via `@react-email/render`, sent through Resend
- Vitest (node env)

## Commands

Run from the repo root (`corepack enable` once; pnpm version comes from `packageManager`).

| Command                                         | Purpose                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm install`                                  | Install all workspaces                                                                        |
| `pnpm dev` / `dev:api` / `dev:admin`            | turbo: api (nodemon + **ts-node**) and/or admin (Vite :5173)                                  |
| `pnpm build`                                    | turbo build (shared-types → api `dist/`, admin `dist/`)                                       |
| `pnpm typecheck` / `lint` / `test`              | turbo across workspaces                                                                       |
| `pnpm lint:fix`                                 | ESLint `--fix` from the root config                                                           |
| `pnpm format` / `format:check`                  | Prettier (whole repo)                                                                         |
| `pnpm --filter @tsyvinda/api test:coverage`     | Vitest + v8 coverage                                                                          |
| `pnpm email:dev`                                | React-email preview server (`apps/api/src/emails`, port 3001)                                 |
| `pnpm db:migration:generate` / `run` / `revert` | TypeORM CLI in `apps/api` (`-d src/db/database.ts`); `:run:prod` / `:revert:prod` use `dist/` |
| `pnpm cert`                                     | mkcert TLS pairs for `BACKEND_HOST` + `ADMIN_HOST` (`scripts/certs.sh`)                       |

Single test: `pnpm --filter @tsyvinda/api exec vitest run path/to/file.test.ts` (or `-t "<name>"`);
same with `@tsyvinda/admin`. The api `dev`/`test` tasks depend on `^build`, so shared-types is
compiled first (the admin resolves it from source via a Vite alias).

> **Dev/test run on `ts-node` and SWC, not `tsx`/esbuild.** NestJS DI requires
> `emitDecoratorMetadata` (`design:paramtypes`), which esbuild does not emit. `nodemon`
> runs `ts-node --transpile-only`; Vitest uses the `unplugin-swc` plugin
> (`decoratorMetadata: true`) in `vitest.config.ts`. Do not switch dev/test back to `tsx`.

## Project Layout

Paths below are inside `apps/api/`. One `.env` lives at the repo root; the api loads it via
`src/shared/load-env.ts` (any cwd), the admin via Vite `envDir` (only `ADMIN_PUBLIC_*` reaches the bundle).

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
  admin/            Admin surface: admin-api.module.ts (RouterModule prefix /admin, ADMIN_API_MODULES),
                    guards/ (AdminGuard, AdminOriginGuard, AdminGuardsModule), auth/ (login/refresh/logout/me,
                    AdminBootstrapService), dashboard/ (GET /admin/dashboard), posts/ (CRUD on any post: paged list
                    `{ items, total }`, multipart cover upload, `removeImage`, empty description clears),
                    users/ (list/search/role filter with `postCount`; PATCH role and/or avatar `image`/`removeImage`;
                    DELETE. 409s: CANNOT_DEMOTE_SELF, LAST_ADMIN, CANNOT_DELETE_SELF, USER_HAS_POSTS: posts cascade on delete),
                    settings/ (GET/PATCH /admin/settings: site-wide settings row, e.g. `indexingEnabled`;
                    public read at GET /site-settings via modules/site-settings)
```

### Content languages (en default, uk)

`LOCALES` / `DEFAULT_LOCALE` / `CONTENT_LOCALE_HEADER` live in `packages/shared-types/src/locales.ts`.
Posts keep shared fields (slug, author, categories, status, publishedAt) in `posts`; title, lead,
body, cover (`imageUrl` + `coverAlt`), SEO overrides, OG image and canonical are per language in
`post_translations` (PK `postId, locale`). Category names are in `post_category_translations`
(slug shared). Migration `1780500000000-ContentLocales` moved existing content into `en`.

- Website endpoints take `?locale=` (default en): `/posts` and `/posts/:slug` return only posts
  translated into that language (404 otherwise); category names fall back to English. Responses
  carry `locale` and `locales` (languages the post exists in, for hreflang).
- Admin endpoints read the language being edited from `X-Content-Locale` (`@ContentLocale()`,
  `admin/content-locale.decorator.ts`; 400 `INVALID_LOCALE`). PATCH writes that language's fields
  and creates the version when missing (needs title + content, else 400 `TRANSLATION_INCOMPLETE`).
  `DELETE /admin/posts/:id/translations/:locale` removes one version (409 `LAST_TRANSLATION`).
  Replaced/removed images are deleted from S3 only when no other language version uses them.
- Admin app: `lib/contentLocale.ts` (store + localStorage `admin.contentLocale`); `apiClient` sends
  the header on every call; `layout/LanguageSwitcher.tsx` in the app bar (asks before discarding
  unsaved edits, resets react-query cache, `CustomLayout` remounts the page per language);
  `components/Translations.tsx` (language chips, missing-version notice, "Languages" card).
- Dev DB runs `synchronize`: when an entity change moves data between tables, stop the `app`
  container and run the migration's `up` first, or synchronize drops the old columns.

Admin app (`apps/admin/src/`): `services/apiClient.ts` (thin `fetch` wrapper, `credentials: 'include'`, single-flight refresh on 401,
`toHttpError` maps our error body to RA `HttpError`), `auth/` (authProvider + sessionStore: cached user is only a
"signed in" hint), `providers/dataProvider.ts` (generic REST: `GET /<resource>` → `{ items, total }`, `page`,
`perPage`, `sort`, `order`, filters as query params; plus `getDashboard`), `resources/resources.config.tsx`
(single source for resources; views lazy-loaded), `resources/posts/` (list/create/edit/delete; `toPostPayload` maps the
form to the API body), `components/HtmlEditorInput.tsx` (`ra-input-rich-text`/TipTap with a Visual ⇄ HTML source toggle),
`pages/` (LoginPage, Dashboard), `layout/`, `theme/`. A form value holding `{ rawFile }` makes the dataProvider send
multipart; apiClient passes FormData through untouched (fetch sets the multipart boundary) and only JSON-encodes plain objects.

### CMS pages (website content)

Plan/report: `docs/plans/cms-pages.md`, `docs/reports/cms-pages.md`. Port of the Delta Lektorat page system.

- **Definitions** live in `packages/shared-types/src/content/`: `PAGE_DEFINITIONS` (fixed page keys — pages are
  never created in the admin; routed or not, default slugs, **hardcoded `sections`** with anchors: editors fill
  them in, never add/remove/reorder) and `BLOCK_DEFINITIONS` (field trees; a `group` field nests a sub-object,
  e.g. `data.experience.roles`; an `image` field stores an uploaded file's URL, e.g. the hero `avatar`, with optional
  `crop` {aspect, outputWidth, shape}; a text's optional `recommendedLength` drives the admin's "N characters,
  recommended: a–b" hint, used for SEO title/description). No shared content: each page keeps its own copy. The API validates content with
  them (`normalizePageContent` always returns exactly the page's sections, matched by position + type), the admin
  renders forms from them (`components/cms/FieldInput.tsx`), the seed uses them. **New section** = block
  definition + page's `sections` + seed + the website's zod schema and view. **New page** = definition +
  `seed/default-content.ts` + website view.
- `src/modules/cms/`: entities (`pages` draft jsonb with every text as `{ en, uk }` + `version` lock,
  `page_revisions` live snapshots, `page_slugs` per-language segments with history — one current per
  page/locale via partial unique index, `redirects`), `content/` (pure: field normalising +
  required check + per-language flattening, `sanitize-html` rich text, `page:<key>` links, route index),
  services, public controllers `GET /pages/:key?locale=`, `GET /routes`, `GET /routes/resolve?path=&locale=`
  (600/min throttle: the website server calls them).
- Admin: `src/admin/pages` (`GET ?q=`; PATCH content with `version` → **live on save** (Delta Lektorat model: new
  revision + publish in one transaction), 409 `VERSION_CONFLICT`, 400 `VALIDATION_FAILED` with `fieldErrors` paths
  like `draft.blocks.0.data.title.en` for empty required fields, `SLUG_MISSING`; PUT slugs — live, no version; no
  publish/unpublish endpoints; `POST /admin/pages/uploads` (multipart `image`) → `{ url }` in S3 `pages/` —
  the editor uploads on pick, and a save deletes `pages/` images the content no longer shows), `src/admin/redirects` (no loops/chains). Admin app: Pages top-level under
  "Management", Redirects under Settings; page editor = Content/SEO tabs, numbered accordion per fixed section; image fields
  (`components/cms/ImageFieldInput.tsx`) open `ImageCropDialog` (canvas, no package; math in `lib/imageCrop.ts`)
  on pick and upload the crop as webp; re-cropping a stored image needs CORS on the image host for the admin
  origin. The SEO share image (`seo.ogImageUrl`) is such an upload, cropped to 1200×630.
- `CmsSeedService` (boot): inserts missing pages, live, never overwrites.
- `RevalidationService`: POSTs cache tags to `WEBSITE_REVALIDATE_URL` (bearer `WEBSITE_REVALIDATE_SECRET`, both
  optional) after CMS and post changes; tags: `page:<key>`, `routes`, `posts`, `post:<slug>`.
- Reserved slugs (`RESERVED_SLUGS`): the website's fixed routes and files (login, registration, profile, …).

## Module pattern

Each feature is `src/modules/<name>/`:

- `<name>.controller.ts` — `@Controller('<route>')`, route handlers returning values (or `@Res({ passthrough: true })` when setting cookies)
- `<name>.module.ts` — `@Module` wiring `TypeOrmModule.forFeature([...])`, providers, controllers; imports `AuthModule` to consume `AuthGuard`
- `services/<name>.service.ts` — `@Injectable()` business logic; inject `@InjectDataSource()` / `@InjectRepository()`
- `entities/*.entity.ts` — TypeORM entity (glob: `modules/**/*.entity.{ts,js}`)
- `dto/*.dto.ts` — request DTOs (class-validator); `dto/*.response.ts` — `@ApiProperty` response models for Swagger
- `guards/`, `decorators/` (auth module) — `AuthGuard`, `@CurrentUser()`

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
- **Auth**: `@UseGuards(AuthGuard)` (reads `access` cookie, verifies JWT); read the user with `@CurrentUser()`. There is no admin approval of website accounts (removed; `users.approvedByAdmin` dropped).
- **Admin surface** (`src/admin/`): controllers live only there and are listed in `ADMIN_API_MODULES` (route prefix `/admin` + the `/docs-admin` Swagger doc). Every admin controller carries `@UseGuards(AdminOriginGuard)`; every non-auth handler also `AdminGuard`. Sessions are separated by **surface**: access JWTs carry `surface: 'website' | 'admin'` (missing = website), `refresh_tokens.surface` stops cross-surface rotation, admin cookies are `admin_access` / `admin_refresh` (host-only, `Path=/admin`). Admin login = `AuthService.login({ surface: 'admin' })`, rejects non-`ADMIN` users with the same 401 as a bad password. `AdminGuard` re-reads `users.role` per request (demotion is immediate). `AdminOriginGuard` rejects cookie writes whose `Origin` isn't `https://ADMIN_HOST` or the API host (CSRF). `ADMIN_DEFAULT_EMAIL`/`PASSWORD` creates (or promotes) the default admin on boot, never overwrites a password.
- **Rate limit**: `@nestjs/throttler` + `@nest-lab/throttler-storage-redis`. Global default 100/60s via `ThrottlerGuard`; per-route overrides with `@Throttle({ default: { limit, ttl } })`. Admin login: 5/min per IP then a 15-min IP block (`blockDuration`), plus `AdminLoginLockoutService` (10 failed logins per email → 429 `LOGIN_LOCKED` for 15 min, counter reset on success).
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
- Local HTTPS dev: map `127.0.0.1 <BACKEND_HOST> <ADMIN_HOST>` in `/etc/hosts`, then `pnpm cert`; `docker compose up` serves the admin (Vite in the `admin` container) at `https://<ADMIN_HOST>` and, via the `fe-proxy` service, the natively running fe (`npm run dev:local` in `../fe`, host :3000) at `https://tsyvinda.local` (keep it in `FRONTEND_HOST`; `/etc/hosts` needs `tsyvinda.local` too)
- `config.isDev` controls TypeORM `synchronize` and `logging` — never enable in prod
- `app.set('trust proxy', config.trustProxyHops)` — `TRUST_PROXY_HOPS`, default 1 (nginx-proxy locally; ingress-nginx in prod, which rewrites the client IP from `CF-Connecting-IP` for Cloudflare ranges only). Prod moves to Traefik + Gateway API (infra `docs/plans/gateway-api-migration.md`): Traefik trusts `X-Forwarded-For` only from Cloudflare ranges and appends the edge, so prod then needs `TRUST_PROXY_HOPS=2`. With 1 behind Traefik, `req.ip` would be the Cloudflare edge for every visitor (rate limits, login IP block). Never set it higher than the real number of trusted proxies — extra hops let clients spoof `X-Forwarded-For`

## Testing

- Vitest, node env. Test files colocated as `*.test.ts` (root or inside modules).
- HTTP tests boot a Nest app via `@nestjs/testing` (`Test.createTestingModule(...).createNestApplication()`) + supertest; stub guards with `.overrideGuard(...)`, services with `useValue`.
- **New features require Vitest tests.** Cover the controller/service. Admin views: Vitest + RTL inside RA's `<AdminContext>` with a mocked dataProvider/authProvider; providers mock `apiClient`.
- supertest binds a local port: inside the Claude sandbox api HTTP tests fail with `listen EPERM` (sandbox, not code).
- CI runs `pnpm turbo run build` → `test` (`.github/workflows/ci.yml`). `format:check`/`lint`/`typecheck` are local-only — run `pnpm typecheck && pnpm test` before pushing.
- Deploy job builds `apps/api/Dockerfile` (always) and `apps/admin/Dockerfile` (only when `ECR_ADMIN_REPOSITORY` is set; deploy config comes from Infisical prod `/CI` + `/CI/BE` via OIDC; `ADMIN_PUBLIC_API_URL` is baked at build time).

## Git workflow

- Branch off `main`, open PR, merge after CI green. Don't push directly to `main`.
- Remote: `git@github.com:bardin-28/api.tsyvinda.com.git`.

## Gotchas

- **Decorator metadata toolchain** (see Commands note) — dev/test must stay on ts-node/SWC, never tsx/esbuild, or Nest DI silently injects `undefined`. (The admin app uses Vite/esbuild freely — no Nest DI there.)
- **pnpm strict layout** — only declared deps are importable. Augment Express types through the global `Express` namespace, not `express-serve-static-core`. New packages with install scripts must be listed in `allowBuilds` (`pnpm-workspace.yaml`).
- **Dockerfiles build from the repo root**: `docker build -f apps/api/Dockerfile --target production .` (prod = `pnpm deploy --prod`), `docker build -f apps/admin/Dockerfile --build-arg ADMIN_PUBLIC_API_URL=… .`. The admin runtime is `nginx-unprivileged` (uid 101, port **8080**, writes only `/tmp`; `absolute_redirect off` so redirects stay relative behind the ingress) — prod runs it non-root with a read-only root fs (infra `helm/admin`, `admin.tsyvinda.com`). The infra repo's `deploy-backend-local.sh` must pass `-f apps/api/Dockerfile`.
- **Admin cookies are `Path=/admin`** — they never reach website routes; don't widen the path.
- **TurnstileInterceptor ordering** — after `FileInterceptor` on multipart routes.
- **Security headers**: API = `src/shared/security-headers.ts` (`securityHeaders()` in `index.ts`): Helmet with a JSON-only CSP (`default-src 'none'`, `frame-ancestors 'none'`), HSTS 2y + includeSubDomains, COEP `require-corp`, `X-Frame-Options: DENY`, plus `Permissions-Policy`. `/docs*` (Swagger) gets Helmet without CSP/COEP so its init script loads — don't merge them. Admin = `apps/admin/security-headers.conf`, `include`d at server level **and** in every `location` with its own `add_header` (nginx drops inherited ones otherwise); its CSP `connect-src` placeholder `__ADMIN_API_ORIGIN__` is filled from `ADMIN_PUBLIC_API_URL` in the Dockerfile build stage.
- `AppDataSource` in `src/db/database.ts` exists only for the `db:migration:*` CLI; it shares `dataSourceOptions` with `TypeOrmModule.forRoot`. Don't delete it.
- `@nestjs/throttler` sets its own rate-limit response headers (not the old `express-rate-limit` draft-7 headers).
- Use `docker compose` (v2, space), not `docker-compose` (v1, Python, broken on macOS).
- Postgres major-version upgrades require dump/restore (volume data format is version-tied).
- Don't install new packages without confirming first — check `package.json` before adding deps.

## Important Notes

1. **Do not refactor existing models opportunistically.** Change a model only when the current task directly requires it, and explain what changed and why in the phase summary.
2. **Do not install new packages** without asking first. Check `package.json` before suggesting additions.
3. **NDA-affiliated repo** — never include `Co-Authored-By` trailers or mention Anthropic/Claude in commit messages, PR descriptions, or code comments.
