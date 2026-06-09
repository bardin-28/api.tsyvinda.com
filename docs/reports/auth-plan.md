# Plan: Auth Module — Register / Confirm / Login / Profile (AUTH-001)

## Goal

Add a self-contained `auth` module providing email + password authentication for the blog backend with email confirmation via Resend, short-lived access JWT plus rotating opaque refresh token (httpOnly cookie), and a `GET /auth/me` profile endpoint. Schema is shaped now to host Google OAuth later via a separate `user_identities` table without migrations on `users`. File upload for profile images is **out of scope**; the `users.profile_image_url` column is added so it can be populated by a follow-up avatar-upload feature.

---

## Requirements

_Captured from the developer:_

- Four user-facing endpoints:
  1. `POST /auth/register` — body: `firstName`, `lastName`, `email`, `password`, `confirmPassword`. Sends a Resend email containing `${FRONTEND_HOST}/registration?token=${rawToken}`.
  2. `POST /auth/confirm-email` — body: `{ token }`. Marks the user as verified.
  3. `POST /auth/login` — body: `email`, `password`. Returns access token + sets refresh cookie.
  4. `GET /auth/me` — requires `Authorization: Bearer <accessToken>`. Returns the authenticated user's profile.
- A `users` table must exist with at least: `firstName`, `lastName`, `email`, `profileImageUrl`.
- Tests cover the new functionality with mocked data (no real DB / Resend hits in CI).
- Schema must accommodate future Google OAuth.
- File-storage approach for profile images must be proposed (see _Important Notes_).

_Implied by the chosen JWT strategy (Access + Refresh, confirmed):_

- `POST /auth/refresh` — rotates the refresh cookie, returns a new access token.
- `POST /auth/logout` — revokes current refresh token and clears the cookie.

---

## Architectural decisions

- **Module layout** — A single `src/modules/auth/` folder owns routes, controller, service, middleware, zod schemas, JWT/refresh service, Resend email service, and three entities (`user-identity`, `email-verification`, `refresh-token`). The `users` entity lives in its own `src/modules/users/` folder so it is reusable and matches the resource it represents. `users/` only adds the entity in this plan — no `users` routes are created yet (`GET /auth/me` covers the single user-read use case).
- **Identity model — separate `user_identities` table** (confirmed). `users.password_hash` is nullable (Google OAuth users won't have one); a `user_identities` row pins each external provider (`provider` + `provider_user_id`, unique together) to a `user_id`. Email/password registration creates a `user_identities` row with `provider = 'local'`, `provider_user_id = users.id::text`.
- **Password hashing — `bcrypt` cost 12** (confirmed). Hash compare in constant time via `bcrypt.compare`. `BCRYPT_COST` env-tunable for tests (cost 4 in test env to keep the suite fast).
- **JWT — Access + Refresh, refresh in httpOnly cookie** (confirmed).
  - Access: signed JWT, HS256, 15 min TTL, payload `{ sub: userId, type: 'access' }`. Returned in JSON on `/auth/login` and `/auth/refresh`. Verified by `requireAuth` middleware.
  - Refresh: **opaque** 32-byte random token (base64url), 30 d TTL. The raw token goes only in the response cookie; only its SHA-256 hash is persisted in `refresh_tokens`. Rotation on each `/auth/refresh` (old row → `revoked_at = now()`, `replaced_by_id = newRow.id`); reuse of a revoked token revokes the whole chain (`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL`).
  - Cookie name `rt`, attributes `httpOnly; Secure; SameSite=Lax; Path=/auth; Domain=${COOKIE_DOMAIN || omitted}; Max-Age=2592000`.
- **Email confirmation — DB-backed `email_verifications` table** (confirmed). Same 32-byte random opaque token, SHA-256 hashed at rest. 24 h TTL, single-use (`consumed_at`). The raw token is only ever in the email body and the inbound request; never logged.
- **Resend integration** — single `EmailService` wrapping `resend.emails.send` with a typed `sendVerificationEmail({ to, firstName, url })` method. In `NODE_ENV=test` and when `RESEND_API_KEY` is `'test'`, the service short-circuits to `logger.debug` so tests do not need to mock the HTTP call (tests still mock the service to assert call args).
- **Generic auth errors** — Login returns `401 INVALID_CREDENTIALS` for both "no such email" and "wrong password" to avoid enumeration. Register, however, returns `409 EMAIL_TAKEN` (UX: a blog signup must tell the user the address is in use — this is consistent with most consumer products, accepted trade-off).
- **Rate limit** — Global limiter already runs (`src/shared/rate-limit.ts`, Redis-backed). Add a tighter per-route limiter on `POST /auth/login` and `POST /auth/register` (10 req/min/IP) using the existing `buildRateLimiter` factory with overrides. No new dep.
- **Validation** — All bodies validated via the existing `validate({ body })` middleware + zod schemas in `auth.schemas.ts`. Email lowercased + trimmed in the schema. Password rule: ≥8 chars, ≥1 letter, ≥1 number (basic, can be tightened later). `confirmPassword` validated with `superRefine` to check equality.
- **Schema migration** — Dev relies on TypeORM `synchronize: true` (project convention). For prod we generate one migration once entities are stable (`npm run db:migration:generate -- src/migrations/CreateAuth`). The plan adds the npm command step but does not run it until Phase 6 to avoid regenerating during iteration.
- **Profile image storage** — Out of scope for this plan; the column is added as a nullable string. Recommendation (separate follow-up): DigitalOcean Spaces (S3-compatible) + `multer` memory storage + `sharp` resize + `@aws-sdk/client-s3` upload to `avatars/{userId}.webp`. Store the public CDN URL in `users.profile_image_url`. Rationale: production-grade, CDN built-in, droplet-friendly (you already run on DO), and `sharp` normalizes format + strips EXIF (privacy + size). Local-disk is rejected (lost on redeploy, no CDN); bytea in Postgres is rejected (bloats backups, slow). Cloudflare R2 is an acceptable alternative if egress costs ever matter.
- **New env vars** — Added to `.env.example`:
  - `JWT_ACCESS_SECRET` (required, ≥32 chars)
  - `JWT_ACCESS_TTL` (default `15m`)
  - `REFRESH_TTL_DAYS` (default `30`)
  - `BCRYPT_COST` (default `12`, tests override to `4`)
  - `RESEND_API_KEY` (required in prod; `'test'` sentinel in dev/test bypasses send)
  - `EMAIL_FROM` (required in prod; e.g. `"Blog <noreply@example.com>"`)
  - `COOKIE_DOMAIN` (optional; omitted ⇒ host-only cookie)
- **New runtime deps (need install confirmation)** — `bcrypt`, `jsonwebtoken`, `resend`, `cookie-parser`.
- **New dev deps (need install confirmation)** — `@types/bcrypt`, `@types/jsonwebtoken`, `@types/cookie-parser`.
- **Logging discipline** — Raw tokens (access, refresh, verification) are **never** logged. The pino logger config already redacts `req.headers.authorization` / `req.headers.cookie` / `*.password` / `*.token`; the auth code adds no log statements containing the raw secrets.

---

## Implementation Checklist

### ✅ Phase 1 — Dependencies, env, shared utilities

- **Step 1** — Confirm install with developer, then add deps:
  - runtime: `bcrypt`, `jsonwebtoken`, `resend`, `cookie-parser`
  - dev: `@types/bcrypt`, `@types/jsonwebtoken`, `@types/cookie-parser`
- **Step 2** — Extend `src/config/app.config.ts` zod schema with the seven new env vars listed under **Architectural decisions → New env vars**. Expose them as `config.auth = { jwtAccessSecret, jwtAccessTtl, refreshTtlDays, bcryptCost }`, `config.email = { resendApiKey, from }`, `config.cookieDomain`. Keep secrets out of `loadConfig`'s logged surface (zod throws an aggregated message on missing values — that's fine, the secret value is never embedded in the error).
- **Step 3** — Update `.env.example` with the new vars, each with a short inline comment.
- **Step 4** — Update `src/config/app.config.test.ts` to inject the new required vars in `baseEnv` so the existing suite still passes; add one new case asserting that a missing `JWT_ACCESS_SECRET` rejects.
- **Step 5** — Add `cookie-parser` middleware in `src/app.ts` (before routes, after `helmet`/`cors`). `app.use(cookieParser())`.
- **Step 6** — Add `src/modules/auth/password.ts` with `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, hash: string): Promise<boolean>`. Reads `config.auth.bcryptCost`.
- **Step 7** — Add `src/modules/auth/tokens.service.ts` with:
  - `signAccessToken(userId: string): string`
  - `verifyAccessToken(token: string): { sub: string }` (throws `HttpError(401, 'INVALID_TOKEN', ...)` on failure).
  - `generateOpaqueToken(): { raw: string; hash: string }` (32 random bytes, base64url, SHA-256 hash).
  - `hashOpaqueToken(raw: string): string`.

### ✅ Phase 2 — Entities + types

- **Step 1** — Create `src/modules/users/user.entity.ts`:
  - columns: `id` (uuid pk), `firstName`, `lastName`, `email` (unique, citext-free for now — lowercased in app code), `passwordHash` (nullable), `profileImageUrl` (nullable), `emailVerified` (boolean default false), `createdAt`, `updatedAt`.
  - decorators: `@Entity('users')`, `@PrimaryGeneratedColumn('uuid')`, `@Index({ unique: true })` on `email`.
- **Step 2** — Create `src/modules/auth/user-identity.entity.ts`:
  - columns: `id` (uuid), `userId` (uuid FK → users), `provider` (`'local' | 'google'`, varchar), `providerUserId` (varchar), `createdAt`.
  - unique index on `(provider, providerUserId)`.
  - `@ManyToOne` back to `User` with `onDelete: 'CASCADE'`.
- **Step 3** — Create `src/modules/auth/email-verification.entity.ts`:
  - columns: `id` (uuid), `userId` (uuid FK), `tokenHash` (varchar(64), unique index), `expiresAt`, `consumedAt` (nullable), `createdAt`.
- **Step 4** — Create `src/modules/auth/refresh-token.entity.ts`:
  - columns: `id` (uuid), `userId` (uuid FK), `tokenHash` (varchar(64), unique index), `expiresAt`, `revokedAt` (nullable), `replacedById` (nullable uuid self-FK), `createdAt`, `userAgent` (nullable varchar(255)), `ip` (nullable varchar(45)).
- **Step 5** — Boot the app once locally (`npm run dev`) to confirm `synchronize: true` creates the four tables cleanly. _No commit yet._

### ✅ Phase 3 — Auth service, controller, routes, middleware

- **Step 1** — Add `src/modules/auth/auth.schemas.ts` exporting zod schemas:
  - `registerBodySchema` — `firstName` 1..50, `lastName` 1..50, `email` `.email().toLowerCase().trim()`, `password` 8..72 with letter+digit regex, `confirmPassword`. `.superRefine` enforces `password === confirmPassword`.
  - `confirmEmailBodySchema` — `{ token: z.string().min(32) }`.
  - `loginBodySchema` — `{ email: ..., password: z.string().min(1) }`.
- **Step 2** — Add `src/modules/auth/email.service.ts`:
  - exports `emailService.sendVerificationEmail({ to, firstName, url })`.
  - constructs the URL as `${config.frontendHost[0]}/registration?token=${rawToken}` (rejects if `frontendHost` array empty — throws `HttpError(500, 'EMAIL_NOT_CONFIGURED', ...)`).
  - HTML body + plain-text fallback (one short helper, no template engine).
  - If `config.email.resendApiKey === 'test'` ⇒ skip the SDK call and `logger.debug({ to, url }, 'email:verify (mocked)')`.
- **Step 3** — Add `src/modules/auth/auth.service.ts` with:
  - `register({ firstName, lastName, email, password })` — checks email uniqueness (409 `EMAIL_TAKEN` if exists), hashes password, opens a `dataSource.transaction` to insert `User` + `UserIdentity { provider:'local', providerUserId: user.id }` + `EmailVerification`, then (outside the transaction) calls `emailService.sendVerificationEmail`.
  - `confirmEmail(token)` — `hashOpaqueToken`, look up by `tokenHash`; reject `400 INVALID_TOKEN` if missing/expired/consumed; set `consumedAt = now()`; set `user.emailVerified = true`. Idempotency: re-confirming returns `200` without error if user already verified and the row was already consumed within the last hour.
  - `login({ email, password, userAgent, ip })` — find user, `bcrypt.compare`, require `emailVerified=true` else `403 EMAIL_NOT_VERIFIED`, then issue access + refresh.
  - `rotateRefresh({ rawRefresh, userAgent, ip })` — see decisions. On reuse detection (token hash matches a row with `revokedAt != null`), revoke the whole user chain and throw `401 REFRESH_REUSE`.
  - `logout(rawRefresh)` — mark current refresh `revokedAt = now()`. Silent if missing.
  - `getProfile(userId)` — returns the `{ id, firstName, lastName, email, profileImageUrl, emailVerified, createdAt }` view; throws `404 USER_NOT_FOUND` if missing.
- **Step 4** — Add `src/modules/auth/auth.middleware.ts`:
  - `requireAuth(req, res, next)` — extracts `Bearer` token from `Authorization`, verifies access JWT, attaches `req.user = { id }`. Augment Express `Request` type via module declaration in this file. Throws `HttpError(401, 'UNAUTHENTICATED', ...)` on any failure.
- **Step 5** — Add `src/modules/auth/auth.controller.ts` with one async handler per endpoint (`register`, `confirmEmail`, `login`, `refresh`, `logout`, `me`). Each wraps `authService` and writes the response. `login`/`refresh` set the `rt` cookie via `res.cookie('rt', raw, cookieOpts)`. `logout` calls `res.clearCookie('rt', cookieOpts)`. The cookie-options helper lives at the top of the file (one tiny function `buildRefreshCookieOpts()`).
- **Step 6** — Add `src/modules/auth/auth.routes.ts`:
  - mount validators + `asyncHandler(controller.x)` for each route.
  - per-route stricter rate-limit on `/register` and `/login` using `buildRateLimiter({ windowMs: 60_000, limit: 10 })`.
  - swagger `@openapi` JSDoc per route, referencing the existing `Error` schema for failure responses. Add a new `components.schemas.User` and `components.schemas.AuthLoginResponse` in `src/config/swagger.ts` to avoid copy-paste.
- **Step 7** — Wire `app.use('/auth', authRouter)` in `src/app.ts`, before `notFound`.

### ✅ Phase 4 — Swagger polish + DTO contract (folded into Phase 3 + 6)

- **Step 1** — Add `User` and `AuthLoginResponse` to `src/config/swagger.ts → components.schemas`. (`User` exposes only the public shape — no password hash.)
- **Step 2** — Verify `/docs` loads locally and lists `/auth/*` with their request/response examples.
- **Step 3** — Update `README.md` "Auth" section with: env vars, sample curl for the four endpoints, and a sentence about the refresh-cookie + access-bearer split.

### ✅ Phase 5 — Tests

- **Step 1** — Set `BCRYPT_COST=4` and `RESEND_API_KEY=test` in `vitest.config.ts → test.env` so tests are fast and never hit Resend.
- **Step 2** — `src/modules/auth/password.test.ts` — hash + verify happy path; verify mismatch returns false.
- **Step 3** — `src/modules/auth/tokens.service.test.ts` — sign + verify access; reject expired (`signAccessToken` with `expiresIn: '-1s'`); `generateOpaqueToken` produces 43-char base64url + 64-char hex hash; `hashOpaqueToken` is deterministic.
- **Step 4** — `src/modules/auth/auth.service.test.ts` — unit tests with **in-memory repository fakes** (no DB) covering:
  - register: 409 on duplicate email, success path inserts user + identity + verification + calls `emailService.sendVerificationEmail` with the right URL.
  - confirmEmail: success flips `emailVerified`; expired/consumed/missing → 400; idempotent re-confirm.
  - login: wrong password → 401 generic; unverified → 403; success returns access + raw refresh + persists hash.
  - rotateRefresh: happy rotation; reuse detection revokes the user's chain.
- **Step 5** — `src/modules/auth/auth.routes.test.ts` — supertest integration. Mock `AppDataSource` (existing pattern in `app.test.ts`) + `emailService.sendVerificationEmail` via `vi.mock`. Cover: 400 on validation failure, 201 on register, 200 on confirmEmail with mocked verification row, 401 on `/auth/me` without bearer, 200 on `/auth/me` with bearer.
- **Step 6** — Run `npm run typecheck && npm test`. All green.

### ✅ Phase 6 — Migration + final sweep

- **Step 1** — Run `npm run db:migration:generate -- src/migrations/CreateAuth` to materialize the four new tables as a real migration (so prod has something to apply). Commit the generated file unmodified except for tightening any `text` ⇒ `varchar(255)` if TypeORM emits text on string columns without explicit length.
- **Step 2** — Run full CI chain locally: `npm run format:check && npm run lint && npm run typecheck && npm run build && npm test`.
- **Step 3** — Smoke test against a real Resend sandbox key (developer's account) — single live email, then revert env to `'test'`. _Optional, developer-driven._
- **Step 4** — Re-read every changed file end-to-end. Propose any small follow-ups in this section as a checklist.

---

## Important Notes

- **Install gating** — Phase 1 Step 1 pauses for explicit `npm install` approval, per CLAUDE.md ("Don't install new packages without confirming first").
- **`synchronize: true` in dev** — Adding entities will auto-create the tables on the next boot. That is the project's intended dev workflow. The Phase 6 migration captures the same schema for prod.
- **Token-leak safety** — Raw refresh tokens, raw verification tokens, and access JWTs are never logged. Pino's existing redact paths cover headers; the auth code avoids logging request bodies. Confirmation URLs are constructed only inside `emailService` and only logged in the test sentinel branch.
- **Why opaque refresh tokens (not JWT refresh)** — A JWT refresh would be self-validating but unrevocable without a denylist. An opaque token + DB lookup is naturally revocable and supports the rotation-with-reuse-detection pattern, which is the standard hardening for refresh-token theft. Cost: one DB round-trip per `/auth/refresh`, acceptable for a blog.
- **No avatar upload yet** — `users.profile_image_url` ships as a nullable string. The follow-up file-upload plan should add `multer` (memory storage, 2 MB limit) + `sharp` (resize to 512², strip EXIF, encode webp) + `@aws-sdk/client-s3` (`PutObjectCommand` to a Spaces bucket). That work needs its own approval round.
- **Google OAuth later** — The follow-up plan will (a) add a `googleOAuth` controller that does an OIDC code exchange, (b) `findOrCreateBySocial({ provider:'google', providerUserId, email, firstName, lastName })` in `auth.service.ts`, (c) reuse `user_identities` row creation. No `users` migration needed.
- **Cookies + CORS** — The refresh cookie is `SameSite=Lax`, which works when FE and BE share a parent domain (e.g. `app.tsyvinda.com` + `api.tsyvinda.com`). If the FE is on a fully cross-site origin in prod, switch to `SameSite=None; Secure` and ensure CORS sends `Access-Control-Allow-Credentials: true` + the FE sets `credentials: 'include'`. This is a config flip, not a code change.

---

## Post-implementation follow-ups (out of scope for this plan)

- Profile-image upload endpoint (Spaces / R2 + `multer` + `sharp`, per the proposition above).
- Google OAuth (`POST /auth/google` OIDC code exchange).
- Password reset (`POST /auth/forgot-password` + `POST /auth/reset-password`) — reuses the verification-token + email-service pattern from this plan.
- Resend verification email endpoint (`POST /auth/resend-verification`) with a per-user rate limit.
- Session list / "log out from all devices" endpoint backed by `refresh_tokens`.
