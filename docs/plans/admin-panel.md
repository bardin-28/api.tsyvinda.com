# Plan: Admin panel (monorepo + dashboard + login)

## Goal

Restructure `be/` into a monorepo modelled on Delta Lektorat (`~/Projects/DL/be`) and add a
React-Admin panel. Scope of this iteration: **admin login/logout/session refresh + dashboard**.
No CRUD resources yet — the structure is built so adding them later is "one folder + one config entry".

---

## Requirements

- Same layout/approach as DL be: `apps/api` + `apps/admin` + `packages/*`.
- Admin panel: login page and dashboard only.
- Keep existing API behaviour (website auth, posts, users, uploads, Turnstile) unchanged.

---

## Reference: what DL does (and what we copy vs skip)

| DL be                                                                                              | Copy?                                  | Notes                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm workspaces + Turborepo                                                                        | **Yes** (needs approval — new tooling) | Alternative: npm workspaces, no turbo (zero new deps). See _Open questions_.                                                                                                                                                                    |
| `apps/admin`: React-Admin 5 + MUI + Vite, base `/admin`, nginx image                               | Yes                                    | Copy `auth/`, `services/apiClient.ts`, `layout/`, `theme/`, `pages/LoginPage.tsx`, `pages/Dashboard.tsx`, `resources/resources.config.tsx`, `accessControl.ts` — strip DL-specific stuff (content-locale, analytics, price calculator, Sentry). |
| `packages/shared-types` (User, Role, AuthSession, LoginRequest…)                                   | Yes                                    | Admin imports types, never redefines.                                                                                                                                                                                                           |
| `packages/eslint-config`, `prettier-config`                                                        | Yes                                    | Move our current `eslint.config.mjs` / `.prettierrc.json` there.                                                                                                                                                                                |
| API surfaces: `admin/` vs `website/` folders, `RouterModule` prefix `/admin`, separate Swagger doc | **Yes, minimal**                       | Only `AdminAuthModule` + `AdminDashboardModule` now. Existing modules stay where they are (no opportunistic refactor).                                                                                                                          |
| Separate admin cookies (`dl_admin_access` / `dl_admin_refresh`) + token surface check              | Yes                                    | `admin_access` / `admin_refresh`; access JWT gets `aud: 'admin' \| 'website'`.                                                                                                                                                                  |
| Prisma, DB `Session` table, Argon2, audit log, Joi config                                          | **No**                                 | Stay on TypeORM, `refresh_tokens`, bcrypt, zod.                                                                                                                                                                                                 |
| Password setup/reset, users CRUD, sessions list, analytics                                         | Not now                                | Later iterations.                                                                                                                                                                                                                               |

---

## Architectural decisions

- **Monorepo layout**

  ```
  be/
    apps/
      api/            ← current src/, test config, Dockerfile, nest/ts config (moved via git mv)
      admin/          ← new React-Admin app
    packages/
      shared-types/   ← User, Role, AuthSession, DashboardStats, LoginRequest
      eslint-config/
      prettier-config/
    docker-compose.yml, .env.example, .github/workflows/ci.yml  (root)
  ```

  `git mv` keeps history. Root `.env` stays single source (DL pattern: `ADMIN_PUBLIC_*` prefix is the
  only thing Vite exposes to the bundle).

- **Role on user** — new `role` enum column (`USER` | `ADMIN`, default `USER`) on `users`.
  Migration `AddUserRole`. This is the only model change; required because admin login must reject
  non-admins and `approvedByAdmin` means "approved user", not "is admin".

- **Default admin bootstrap** — like DL: `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD` env; on boot
  create the user (role ADMIN, emailVerified, approved) if missing, never overwrite. Optional in zod
  schema (skip when unset).

- **Admin auth surface** — `apps/api/src/admin/auth/admin-auth.controller.ts` at `/admin/auth`:
  - `POST login` → reuse `AuthService.login` + role check (`ADMIN`), else 401 same message as bad
    password (no account probing). No Turnstile on admin login (panel has no widget) — rely on
    stricter throttle (`5/min/IP`).
  - `POST refresh` → rotates refresh token, only for refresh rows issued for admin surface.
  - `POST logout` → revoke + clear admin cookies.
  - `GET me` → current admin user.
  - Tokens only in httpOnly cookies, never in body.

- **Surface separation**
  - Access JWT payload adds `aud` (`website` / `admin`). `verifyAccessToken(token, surface)` checks it.
  - `refresh_tokens.surface` column (default `website`) so an admin refresh cookie can't mint website
    tokens and vice versa. (Second part of the same migration.)
  - New `AdminGuard` = reads `admin_access` cookie, verifies `aud: admin`, loads user, requires
    `role === ADMIN` (DB check each request so demotion is immediate — cheap at our volume).
  - Website `AuthGuard` rejects `aud: admin` tokens.

- **CSRF** — cookies are `SameSite=Lax`; admin writes additionally require `Origin` in the CORS
  allowlist (small middleware/guard on `/admin/*` non-GET). Add admin origin to CORS allowlist.

- **Dashboard API** — `GET /admin/dashboard` → `DashboardStats`:
  users total / pending approval / unverified email, signups last 7 & 30 days, posts total /
  published (if posts have status) / last 7 days, latest 5 signups. Plain `COUNT` queries via
  repositories, one service, no caching yet.

- **Swagger** — second document at `/docs/admin` built with `include: ADMIN_API_MODULES`, existing
  `/docs` unchanged.

- **Admin app hosting** — separate nginx container, Vite `base: '/admin'`.
  Local: `https://admin.tsyvinda.local/admin` (nginx-proxy vhost + mkcert SAN).
  Prod: `admin.tsyvinda.com` → new Helm chart `helm/admin` in infra (or extra Deployment in
  frontend chart). Cookies: admin cookies scoped to API host (no `COOKIE_DOMAIN` needed since
  `withCredentials` + same-site `tsyvinda.com`).

- **Admin frontend (copied from DL, trimmed)**
  - `services/apiClient.ts` — axios, `withCredentials`, single-flight refresh on 401, `toHttpError`
    adapted to **our** error body `{ error: { code, message, details: { fieldErrors } } }`.
  - `auth/authProvider.ts` + `sessionStore.ts` — identical pattern (localStorage user hint only).
  - `providers/dataProvider.ts` — generic REST stub (getList/getOne/...) + `getDashboard()`;
    unused methods ready for future resources.
  - `pages/LoginPage.tsx` — DL form minus "Forgot password" (no admin reset endpoint yet).
  - `pages/Dashboard.tsx` — welcome + KPI tiles (MUI Cards) + latest signups table.
  - `layout/` (AppBar with user menu/logout + theme toggle, Sidebar), `theme/` (tokens, light/dark).
  - `resources/resources.config.tsx` empty array, ready for `users`, `posts` later.

---

## Implementation Checklist

### ☑ Phase 1 — Monorepo skeleton (no behaviour change)

- **Step 1** — Root `package.json` (workspaces), `pnpm-workspace.yaml` + `turbo.json` (or npm
  workspaces variant), root `tsconfig.json`.
- **Step 2** — `git mv` `src/`, `tsconfig.json`, `vitest.config.ts`, `Dockerfile`, nodemon config,
  TypeORM CLI scripts → `apps/api/`. Fix paths (`dataSourceOptions` globs, migration glob,
  `email:dev`, `cert` script → root).
- **Step 3** — `packages/eslint-config`, `packages/prettier-config`; husky + lint-staged at root.
- **Step 4** — Dockerfile builds from repo root (`docker build -f apps/api/Dockerfile .`), compose
  `app` service context updated.
- **Step 5** — CI: install at root, `turbo run build test` (or `npm run build --workspaces`); deploy
  job builds `apps/api/Dockerfile`. Verify ECR image identical in behaviour.
- **Gate**: `typecheck`, `test`, `build`, `docker compose up` all green; nothing else changed.
  Separate PR.

### ☑ Phase 2 — Shared types + role + admin auth API

- **Step 1** — `packages/shared-types`: `Role`, `User`, `AuthSession`, `LoginRequest`,
  `DashboardStats`. API response DTOs `implements` them.
- **Step 2** — Migration `AddUserRoleAndTokenSurface`: `users.role` enum default `USER`,
  `refresh_tokens.surface` varchar default `website`.
- **Step 3** — Token service: `aud` claim + surface-aware verify; `AuthService.login/rotate` take
  `surface` + optional `allowedRoles`.
- **Step 4** — Admin cookie helpers (`admin_access`, `admin_refresh`), `AdminGuard`, origin check.
- **Step 5** — `src/admin/admin-api.module.ts` (`RouterModule` prefix `admin`),
  `AdminAuthModule` (login/refresh/logout/me), Swagger `/docs/admin`.
- **Step 6** — Default admin bootstrap (`OnApplicationBootstrap`), env in zod + `.env.example`.
- **Step 7** — Tests: controller (supertest) for all 4 routes incl. non-admin 401, website token on
  admin route 401, admin token on website route 401, refresh surface mismatch; guard + service unit.

### ☑ Phase 3 — Dashboard API

- **Step 1** — `AdminDashboardModule`: `GET /admin/dashboard`, `DashboardService` counts.
- **Step 2** — Response DTO with `@ApiProperty`, implements `DashboardStats`.
- **Step 3** — Tests: service (mocked repos), controller (guard overridden + unauth 401).

### ☑ Phase 4 — Admin app

- **Step 1** — Scaffold `apps/admin` (Vite + React 19 + React-Admin 5 + MUI, versions pinned like
  DL), `vite.config.ts` (root env dir, `ADMIN_PUBLIC_` prefix, base `/admin`, port 5173).
- **Step 2** — Port `apiClient`, `authProvider`, `sessionStore`, `theme/`, `layout/` from DL,
  trimmed; adapt error mapping to our error shape.
- **Step 3** — `LoginPage`, `Dashboard` (KPI cards + latest signups), empty resources config.
- **Step 4** — Vitest + RTL tests: authProvider, apiClient refresh flow, LoginPage, Dashboard.
- **Step 5** — `apps/admin/Dockerfile` + `nginx.conf` (copy DL), `ADMIN_PUBLIC_API_URL` build arg.

### ◐ Phase 5 — Local dev + deploy wiring

- **Step 1** — Root scripts `dev`, `dev:api`, `dev:admin`; compose: optional `admin` service or run
  Vite on host behind nginx-proxy vhost `admin.tsyvinda.local`; mkcert SAN; `/etc/hosts` note.
- **Step 2** — CORS allowlist gets admin origin (`ADMIN_HOST` env).
- **Step 3** — CI: admin build + test; second ECR repo/image push (`ECR_ADMIN_REPOSITORY`).
- **Step 4** — infra repo (separate PR, user confirms): Helm chart for admin, ingress
  `admin.tsyvinda.com`, ArgoCD app, ECR repo in Terraform. Cloudflare DNS record → dashboard steps
  for user.
- **Step 5** — Update `CLAUDE.md` (layout, commands, admin auth rules), README, `docs/reports/`.

---

## Important Notes

- **Model change**: only `users.role` + `refresh_tokens.surface`. Explained in Phase 2 summary.
- **New packages need approval** before install — api side: none required. Admin app: react-admin,
  @mui/material, @mui/icons-material, @emotion/*, react-router-dom, axios, vite,
  @vitejs/plugin-react, vitest jsdom + RTL. Tooling: pnpm + turbo (or none with npm workspaces).
- Existing website auth contract (`access` / `refresh` / `has_session` cookies) must not change —
  fe depends on it. New `aud` claim: old access tokens without it treated as `website` during a
  15-min transition (or accept forced re-login).
- Dev/test toolchain stays ts-node + SWC (decorator metadata). Vite for admin only — it has no Nest DI.
- NDA rule: no AI attribution in commits/PRs.

---

## Open questions

1. **Package manager**: pnpm + Turborepo (exact DL parity) or npm workspaces (no new tooling, our
   lockfile stays npm)?
2. **Admin hosting**: separate subdomain `admin.tsyvinda.com` (DL way) or path `api.tsyvinda.com/admin`
   served by the API (no extra deployment, but mixes static hosting into Nest)?
3. **Dashboard content**: KPIs above OK, or other metrics wanted (e.g. S3 storage, recent posts)?
4. **Admin bootstrap**: env-seeded default admin (DL way), or promote an existing user via a one-off
   SQL/CLI command?
