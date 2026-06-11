# Environment Reference — where every variable lives

Single source of truth for **which env var goes where**: local `.env`, k3d Helm
values, k3s (prod) Helm values, and GitHub Actions secrets/vars. The app's contract
is `src/shared/app.config.ts` (zod) — it fails fast on boot if a required var is
missing, so this table mirrors that schema plus the infra-only vars.

> `.env.example` is the **committed template** (placeholder values, no real secrets).
> Copy it to `.env.local` (dev) / `.env.production` (droplet) and fill real values.
> Never commit `.env.local` / `.env.production`.

---

## Legend

| Column | Meaning |
| ------ | ------- |
| **Secret?** | 🔒 = sensitive, never commit a real value. ▫️ = non-sensitive config. |
| **Local (dev)** | Where the value comes from when running `npm run dev` / `docker compose` / k3d. |
| **Prod (k3s)** | Where the value comes from on the droplet / in-cluster. |

For k3d/k3s, "config" = `helm/backend/values-*.yaml` `config:` block → rendered into a
**ConfigMap** (`envFrom`). "secrets" = the `secrets:` block → rendered into a **Secret**.

---

## App variables (consumed by `app.config.ts`)

| Variable | Secret? | Local (dev) | Prod (k3s) |
| -------- | :-----: | ----------- | ---------- |
| `NODE_ENV` | ▫️ | `.env.local` (`development`) / k3d values `config` (`production`) | values-prod `config` |
| `PORT` | ▫️ | `.env.local` / values `config` | values-prod `config` |
| `BACKEND_HOST` | ▫️ | `.env.local` / values `config` | values-prod `config` |
| `FRONTEND_HOST` | ▫️ | `.env.local` / values `config` | values-prod `config` |
| `DATABASE_URL` | 🔒 | `.env.local` / values-local `secrets` | **sealed-secret / CI `--set`** |
| `REDIS_URL` | 🔒 | `.env.local` / values-local `secrets` | **sealed-secret / CI `--set`** |
| `SSL_KEY_PATH` / `SSL_CERT_PATH` | ▫️ | `.env.local` (local HTTPS only; defaults `certs/*.pem`) | n/a (TLS terminated at ingress) |
| `JWT_ACCESS_SECRET` | 🔒 | `.env.local` / values-local `secrets` (placeholder) | **sealed-secret / CI `--set`** |
| `JWT_ACCESS_TTL` | ▫️ | `.env.local` / values base `config` | values `config` |
| `REFRESH_TTL_DAYS` | ▫️ | `.env.local` / values base `config` | values `config` |
| `BCRYPT_COST` | ▫️ | `.env.local` / values base `config` | values `config` |
| `RESEND_API_KEY` | 🔒 | `.env.local` / values-local `secrets` (placeholder) | **sealed-secret / CI `--set`** |
| `EMAIL_FROM` | ▫️ | `.env.local` / values `config` | values-prod `config` |
| `COOKIE_DOMAIN` | ▫️ | `.env.local` (optional) | values `secrets` (optional) |
| `TURNSTILE_SECRET_KEY` | 🔒 | `.env.local` / values-local `secrets` (test key) | **sealed-secret / CI `--set`** (required in prod) |
| `TURNSTILE_BYPASS_TOKEN` | 🔒 | `.env.local` (optional) | sealed-secret (optional) |

### S3 (added with the MiniStack → S3 migration)

| Variable | Secret? | Local (dev) | Prod (k3s) |
| -------- | :-----: | ----------- | ---------- |
| `S3_BUCKET` | ▫️ | `.env.local` / values-local `config` (`tsyvinda-local`) | values-prod `config` — **must match terraform `s3_bucket_name`** |
| `S3_REGION` | ▫️ | `.env.local` / values `config` (`eu-central-1`) | values-prod `config` |
| `S3_ENDPOINT` | ▫️ | `.env.local` / values-local `config` (MiniStack URL) | **omitted** → SDK hits real AWS |
| `S3_PUBLIC_URL` | ▫️ | `.env.local` / values-local `config` (host `:4566/<bucket>`) | values-prod `config` (bucket/CDN base) |
| `S3_FORCE_PATH_STYLE` | ▫️ | `.env.local` / values-local `config` (`true` for MiniStack) | values-prod `config` (`false` / unset) |
| `S3_ACCESS_KEY_ID` | 🔒 | `.env.local` / values-local `secrets` (`test`) | **omitted** → EC2 IAM role supplies creds |
| `S3_SECRET_ACCESS_KEY` | 🔒 | `.env.local` / values-local `secrets` (`test`) | **omitted** → EC2 IAM role supplies creds |

> **Prod S3 has no keys.** The EC2 instance profile (terraform `module.compute` IAM
> role) grants `s3:GetObject/PutObject/DeleteObject` on the bucket. Setting
> `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` in prod would override the role — leave unset.

---

## Infra-only variables (not read by the app)

### docker-compose (`.env.local`)

| Variable | Purpose |
| -------- | ------- |
| `COMPOSE_PROJECT_NAME` | Compose project / container hostname prefix |
| `RESTART_POLICY` | `restart:` policy (`no` dev / `unless-stopped` prod) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres init creds — **password must be byte-identical to the one embedded in `DATABASE_URL`** |
| `LETSENCRYPT_EMAIL` | nginx-proxy ACME contact (prod compose) |
| `BASIC_AUTH` / `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` | nginx-proxy basic-auth gate (prod) |

The `s3-init` one-shot reads `AWS_ACCESS_KEY_ID=test` / `AWS_SECRET_ACCESS_KEY=test`
(hardcoded in compose) and `S3_REGION` / `S3_BUCKET` from `.env.local`.

### GitHub Actions (repo Settings → Secrets and variables → Actions)

The deploy job is keyless OIDC — no AWS keys stored. Configure:

**Secrets** (Settings → Secrets):

| Secret | Purpose |
| ------ | ------- |
| `AWS_DEPLOY_ROLE_ARN` | IAM role assumed via OIDC (terraform `module.cicd` output) |
| `INFRA_REPO_TOKEN` | PAT (or fine-grained token) with `contents:write` on the infra repo — used to bump the image tag |

**Variables** (Settings → Variables):

| Variable | Purpose |
| -------- | ------- |
| `AWS_REGION` | ECR / deploy region (`eu-central-1`) |
| `ECR_REPOSITORY` | ECR repo name (`tsyvinda-backend`) |
| `INFRA_REPOSITORY` | `owner/repo` of the infra repo (e.g. `bardin-28/infra.tsyvinda.com`) |

---

## Prod secret delivery (k3s)

`helm/backend/values-prod.yaml` ships `secrets: {}` on purpose — prod secrets are
**never committed**. Two supported paths:

1. **sealed-secrets** (GitOps, preferred) — `kubeseal` the cluster Secret, commit the
   SealedSecret to infra; the in-cluster controller decrypts it. Keys:
   `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `RESEND_API_KEY`,
   `TURNSTILE_SECRET_KEY` (+ optional `TURNSTILE_BYPASS_TOKEN`, `COOKIE_DOMAIN`).
2. **`helm upgrade --set secrets.<KEY>=<VALUE>`** — out-of-band from CI / SSM at deploy
   time. Same key list. Use for break-glass; sealed-secrets is the steady state.

S3 needs **no** secret in prod (IAM role).

---

## Quick checklist for a new environment

- [ ] `cp .env.example .env.local`, fill real values (dev) — or `.env.production` (droplet)
- [ ] Postgres password identical in `POSTGRES_PASSWORD` and `DATABASE_URL`
- [ ] k3d: secrets live in `values-local.yaml` `secrets:` (placeholders, safe to commit)
- [ ] k3s: create the SealedSecret (or `--set`) for the 🔒 app vars; **do not** add S3 keys
- [ ] GitHub repo: add the 2 Actions secrets + 3 Actions variables above
- [ ] Prod `S3_BUCKET` matches the terraform-created bucket; `S3_PUBLIC_URL` points at it
