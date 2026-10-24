# Report: Admin panel (monorepo + login + dashboard)

Plan: [`docs/plans/admin-panel.md`](../plans/admin-panel.md). Decisions: pnpm + Turborepo, admin on its own
subdomain, default admin from env.

## Phase 1 — Monorepo skeleton

- `git mv` of the API into `apps/api` (history kept); root `package.json` (pnpm 11.9.0 via `packageManager`),
  `pnpm-workspace.yaml` (`allowBuilds`), `turbo.json`; `package-lock.json` → `pnpm-lock.yaml`.
- `packages/eslint-config` (was `eslint.config.mjs`, node globals moved to the root config) and
  `packages/prettier-config` (was `.prettierrc.json`); husky + lint-staged at the root.
- `.env` stays at the repo root: `apps/api/src/shared/load-env.ts` replaces `import 'dotenv/config'` so the API
  finds it from any cwd.
- `apps/api/Dockerfile` builds from the repo root; production stage = `pnpm deploy --prod` output. Compose and
  CI point at it.
- One code change forced by pnpm's strict layout: the `req.user` augmentation moved from
  `express-serve-static-core` (not resolvable without hoisting) to the global `Express` namespace.

## Phase 2 — Shared types + admin auth API

- **Model change** (migration `1780000000000-AddUserRoleAndTokenSurface`):
  - `users.role` (`user_role` enum `USER | ADMIN`, default `USER`) — admin login needs an explicit admin flag;
    `approvedByAdmin` means "approved user", not "is admin".
  - `refresh_tokens.surface` (`website | admin`, default `website`) — stops an admin refresh cookie from minting
    website sessions and vice versa.
- Access JWT gets a `surface` claim; tokens without it are treated as website tokens, so live website sessions
  survive the deploy.
- `AuthService.login/rotateRefresh` take `surface`; admin login rejects non-admins with the same 401 as a wrong
  password; an admin refresh fails once the user is demoted. `getPublicUser`, `role` in `PublicUser`/`UserDto`.
- `src/admin/`: `AdminApiModule` (`RouterModule` prefix `/admin`), `AdminGuard` (admin cookie + admin token +
  role re-read from DB), `AdminOriginGuard` (CSRF: writes only from `https://ADMIN_HOST` / the API host),
  `AdminAuthController` (`login` 5/min, `refresh`, `logout`, `me`), `AdminBootstrapService` (default admin).
- Admin cookies `admin_access` / `admin_refresh`: httpOnly, Secure, SameSite=Lax, host-only, `Path=/admin`.
- Env: `ADMIN_HOST`, `ADMIN_DEFAULT_EMAIL`, `ADMIN_DEFAULT_PASSWORD` (12+ chars, both or neither). Admin origin
  joins the CORS allowlist. Swagger: `/docs` now lists website modules only, `/docs-admin` the admin surface.

## Phase 3 — Dashboard API

- `GET /admin/dashboard` → `DashboardStats`: users (total, admins, pending approval, unverified, new 7/30 days),
  posts (total, new 7/30 days), 5 latest signups (no password hash selected). Plain `COUNT`s in parallel.

## Phase 4 — Admin app (`apps/admin`)

- React-Admin 5.15.4, MUI 9.4.0, Vite 8, React 19 — same versions as the reference panel.
- `apiClient` (single-flight refresh on 401, `toHttpError` maps `{ error: { code, message, details.fieldErrors } }`),
  `authProvider` + `sessionStore`, generic REST `dataProvider` (`{ items, total }` contract) + `getDashboard`,
  `LoginPage`, `Dashboard` (8 KPI tiles + latest signups table), layout, theme (light/dark).
- `resources.config.tsx` is empty and ready: a new resource = folder + one entry.
- `Dockerfile` (`development` stage for compose, `runtime` = nginx serving `/admin`), `nginx.conf`.

## Phase 5 — Local dev + deploy wiring

- Compose `admin` service (Vite behind nginx-proxy at `https://ADMIN_HOST/admin`, HMR on 443), `pnpm cert`
  issues certs for both hosts.
- CI: pnpm install + `turbo run build`/`test`; admin image build/push and helm tag bump only when the
  `ECR_ADMIN_REPOSITORY` repo variable is set (inert until infra exists).
- Docs: `CLAUDE.md`, `README.md`, `.env.example`.

## Verification

- `pnpm turbo run typecheck lint build test`: all green — api 24 files / 159 tests, admin 5 files / 24 tests.
- `pnpm deploy --prod` output checked: `bcrypt`, `@nestjs/core`, `typeorm` load from the pruned tree.
- **Not verified here**: Docker image builds (Docker daemon was not running), the migration against a real
  Postgres, and a live browser sign-in.

## Open follow-ups

- **infra repo** (separate PR): `scripts/deploy-backend-local.sh` must pass `-f apps/api/Dockerfile`; ECR repo for
  the admin image (Terraform); `helm/admin` chart + ingress `admin.tsyvinda.com`; ArgoCD app; backend env
  `ADMIN_HOST`, `ADMIN_DEFAULT_EMAIL`, `ADMIN_DEFAULT_PASSWORD` (SealedSecret).
- GitHub repo variables: `ECR_ADMIN_REPOSITORY`, `ADMIN_PUBLIC_API_URL=https://api.tsyvinda.com/admin`.
- Cloudflare: DNS record for `admin.tsyvinda.com`.
- `.claude/skills/{new-module,migration}` still describe the old single-package paths.
