# Plan: K3d → K3s Infrastructure Rollout (INFRA-K3D-001)

## Goal

Stand up the full platform infrastructure for tsyvinda.com: containerized backend
(`be`, already built) + frontend (`fe`) running on local **K3d**, promoted to production
**K3s** on AWS EC2, provisioned by **Terraform**, deployed by **GitHub Actions**, observed by
**Prometheus / Grafana / Loki**. Architecture must stay EKS-migratable without app changes.

All infra artifacts live in the sibling `../infra` repo. This plan is authored and executed
from `be` — `additionalDirectories` grants write access to `../infra`, so steps that say
"create `infra/...`" are written to `/Users/vladyslavtsyvinda/Projects/tsyvinda.com/infra`.

---

## Requirements

- Reuse the **already-built** backend: NestJS 11 (Express adapter) + TypeORM 0.3 + PostgreSQL 18 + Redis 8. **No Prisma** (original plan was stale).
- Backend Docker image, `docker-compose.yml`, `.dockerignore`, Husky — already exist. Do **not** re-scaffold Phase 1.
- Charts must honor the backend contract: `/health` returns 200/503 (Docker healthcheck), `access` JWT cookie, env via `app.config.ts` zod schema (fail-fast on boot).
- Secrets never committed: `.env*`, `*.tfstate`, `*.key`, `kubeconfig` are gitignored in `infra`.
- Local stack reachable over ingress: `/` → frontend, `/api` → backend.
- Production path: K3d local ≡ K3s prod (same charts, different `values-*.yaml` / overlay) → EKS-ready.
- Each phase reviewable independently — stop after each for developer review. **Do not commit** until approved.
- No new npm packages in `be`/`fe` without explicit approval.

---

## Architectural decisions

- **Helm for app workloads, Kustomize reserved for raw patches** — `infra/helm/backend` + `infra/helm/frontend` charts. Env differences via `values-local.yaml` (K3d) vs `values-prod.yaml` (K3s). `infra/kubernetes/overlays/prod` kept for non-Helm cluster-scoped resources only.
- **One chart, two value files** — same chart deploys to K3d and K3s; only `values-*.yaml` and image tag differ. Guarantees local≡prod parity and EKS portability.
- **Config split: ConfigMap (non-secret) + Secret (sensitive)** — `ConfigMap` holds `NODE_ENV`, `PORT`, hosts, feature flags; `Secret` holds `DATABASE_URL`, `JWT_*`, `REDIS_*`, `RESEND_API_KEY`, `TURNSTILE_*`. Mounted as env. Backend's zod schema validates on boot.
- **Local deps in-cluster** — Postgres + Redis run from official-image manifests in K3d (Bitnami public tags retired 2025; MinIO OSS gutted/unmaintained 2025). Prod uses managed **RDS Postgres + S3** (Terraform); in-cluster deps are **local-only**.
- **Local S3 = MiniStack** (`ministackorg/ministack`, `:4566`) — MIT-licensed LocalStack-compatible emulator; ~30MB/~2s vs LocalStack ~500MB (fits k3d alongside the full stack). Same `@aws-sdk/client-s3`, only `endpoint`+`forcePathStyle` differ locally; real AWS S3 in prod. _Not MinIO_ (OSS gutted), _not LocalStack_ (core S3 moved behind paid plan). See `local-s3-uploads.md` for the upload wiring.
- **ingress-nginx** — single ingress controller both environments. TLS: local self-signed (mkcert/`npm run cert` reused), prod = cert-manager + Let's Encrypt behind Cloudflare.
- **Terraform: modular, remote state** — `infra/terraform/modules/{network,security,storage,database,compute}` consumed by `environments/prod`. State in S3 + DynamoDB lock. No state in git.
- **K3s on single EC2 (bootstrap), HA deferred** — Terraform provisions EC2 + EIP + SG; `cloud-init`/script installs K3s. HPA + multi-node are Future.
- **CI/CD: GitHub Actions → ECR → git, ArgoCD deploys** — backend pipeline `lint → test → build → docker build → push ECR → bump image tag in git`. **No `helm upgrade` from CI, no kubeconfig in CI.** ArgoCD (in K3s) watches the `infra` repo and pull-reconciles. Reuse existing `be` CI (build+test) as lint/test stages.
- **GitOps: ArgoCD app-of-apps** — single root `Application` → child `Application`s per workload (backend, frontend, monitoring, prod-deps). Source = `infra` repo Helm charts + `values-prod.yaml`. `automated` sync (`prune` + `selfHeal`). Git = single source of truth for prod cluster state. Prod only; local k3d stays script-based.
- **Image registry** — Amazon ECR (prod). Local K3d imports images directly via `k3d image import` — no registry needed locally.
- **Monitoring: kube-prometheus-stack + Loki** — Helm umbrella for Prometheus/Grafana/Alertmanager; Loki + promtail for logs. Alertmanager → Telegram + Email.

---

## Implementation Checklist

### ✅ Phase 1 — Backend Foundation _(already done — baseline, do not redo)_

- **Step 1** — NestJS/TS/ESLint/Prettier/Husky — present in `be`.
- **Step 2** — `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `.dockerignore` — present.
- **Step 3** — ORM = TypeORM 0.3 + Postgres 18 (not Prisma). Migrations in `src/db/migrations`.
- **Note** — Commitlint listed in original plan but **not installed**; add later only if desired (optional, gated).

### ✅ Phase 2 — Local Kubernetes Environment (K3d) _(verified live — k3d 5.9.0)_

- **Step 1** — ✅ `infra/scripts/k3d-up.sh`: cluster `api-tsyvinda-local` (matches Docker `COMPOSE_PROJECT_NAME`), ports 80/443 → loadbalancer, 1 server + 1 agent, traefik disabled, preflight checks, `kubectl wait` for Ready. Env-overridable (`CLUSTER_NAME`/`SERVERS`/`AGENTS`/`HTTP_PORT`/`HTTPS_PORT`).
- **Step 2** — ✅ `infra/scripts/k3d-down.sh` (`k3d cluster delete`, idempotent).
- **Step 3** — ✅ `infra/docs/local-setup.md`: prereqs + install + lifecycle + verify.
- **Step 4** — ✅ Verified: `k3d-up.sh` created `api-tsyvinda-local` (K3s v1.35.5, server+agent both Ready, traefik disabled). Caught + cleared a stale `k3d-dev` cluster holding :80.

### ✅ Phase 3 — Backend Kubernetes Deployment (`helm/backend`) _(deployed + verified, helm 4.2.0)_

- **Step 1** — ✅ Chart hand-authored at `infra/helm/backend` (`Chart.yaml`, `_helpers.tpl`, `.helmignore`) — no `helm create` boilerplate (helm not installed).
- **Step 2** — ✅ `templates/deployment.yaml`: image `repository:tag`, `containerPort` 3000 (named `http`), `envFrom` ConfigMap + Secret, **startup/liveness/readiness** `httpGet /health` (startup covers ~15s boot = Dockerfile start-period), checksum annotations roll pods on config/secret change, `IfNotPresent` pull.
- **Step 3** — ✅ `templates/service.yaml`: `ClusterIP` port 80 → `targetPort: http` (3000).
- **Step 4** — ✅ `templates/configmap.yaml`: generic `range` over `.Values.config` (NODE_ENV, PORT, BACKEND_HOST, FRONTEND_HOST, JWT_ACCESS_TTL, REFRESH_TTL_DAYS, BCRYPT_COST, EMAIL_FROM).
- **Step 5** — ✅ `templates/secret.yaml`: `range` over `.Values.secrets`, **empty keys skipped** (DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, RESEND_API_KEY, TURNSTILE_SECRET_KEY, TURNSTILE_BYPASS_TOKEN, COOKIE_DOMAIN). Defaults empty → zod fails fast surfacing missing var.
- **Step 6** — ✅ `values-local.yaml` (image `tsyvinda-backend:local`, **`NODE_ENV=production`** — local runs the prod image, so no `pino-pretty` devDep; turnstile placeholder; in-cluster DNS) + `values-prod.yaml` (ECR repo, tag set by CI, `replicaCount:2`, req/limits, `secrets:{}` out-of-band). **Fix from live run**: `runAsNonRoot` needs numeric `runAsUser:1000` (image `USER node` name unverifiable → `CreateContainerConfigError`).
- **Step 7** — ✅ `infra/scripts/deploy-backend-local.sh`: `docker build --target production` → `k3d image import` → `helm upgrade --install` + `rollout status`. Resolves paths relative to script.
- **Step 8** — ✅ **Verified live**: pod 1/1 Running, `/health` → `{"status":"ok","db":true,"redis":true}` 200, JSON logs, non-root uid 1000. `helm lint` clean. (Helm-4 `helm template` full-render only shows 2 of 6 manifests — cosmetic stdout quirk; `helm install` deploys all, confirmed by `kubectl get`.)

### ✅ Phase 4 — Local Infrastructure Dependencies _(verified live)_

- **Step 1–2** — ✅ **Pivoted off Bitnami** (public image tags retired in 2025 "secure images" migration → `bitnami/postgresql:18` NotFound). Now `infra/kubernetes/local-deps.yaml`: **official `postgres:18-alpine` + `redis:8-alpine`** Deployments+Services (`postgres-postgresql` / `redis-master` DNS preserved, creds `postgres/postgres`, db `app`, readiness probes). Bitnami `postgres-local.yaml`/`redis-local.yaml` **deleted**.
- **Step 3** — 🟡 **Local S3 = MiniStack** (`ministackorg/ministack`) — backend originally disk-only (`/app/uploads`, multer); S3 wiring tracked in `local-s3-uploads.md`. MiniStack added to compose + `local-deps.yaml`.
- **Step 4** — ✅ `infra/helm/values/ingress-nginx-local.yaml`: official chart, `service.type: LoadBalancer` (k3d klipper ↔ host 80/443), `watchIngressWithoutClass: true`.
- **Step 5** — ✅ `infra/scripts/deps-up.sh`: `kubectl apply local-deps.yaml` + `rollout status` (pg/redis) + `helm upgrade --install ingress-nginx`. Idempotent.
- **Step 6** — ✅ Backend `values-local.yaml` DATABASE_URL/REDIS_URL point at in-cluster DNS, creds aligned.
- **Step 7** — ⚠️ **Schema caveat** (changed by Phase 3): local now `NODE_ENV=production` → TypeORM `synchronize` is **OFF**, so tables are NOT auto-created. `/health` only pings the connection (200). To exercise data endpoints locally, run migrations against the in-cluster Postgres.
- **Step 8** — ✅ **Verified live**: postgres + redis + ingress-nginx Running; backend `/health` reports `db:true, redis:true`.

### 🟡 Phase 5 — Infrastructure Repository _(scaffold done — finalize)_

- **Step 1** — ✅ `infra/` skeleton created: `terraform/{modules,environments/prod}`, `kubernetes/{base,overlays/prod}`, `helm`, `scripts`, `docs`, `README.md`, `.gitignore`, `docs/ROADMAP.md`.
- **Step 2** — ✅ `git init` + commits (`47d18b2`, `4f4f944`) pushed to `git@github.com:bardin-28/infra.tsyvinda.com.git` (`main`). No secrets tracked. **Remote live → Phase 8 tag-bump + Phase 9 ArgoCD sync unblocked.**
- **Step 3** — Add `infra/docs/architecture.md` (the target diagram + component responsibilities).
- **Step 4** — Add `infra/Makefile` or `infra/scripts/README.md` indexing the helper scripts (`k3d-up`, `deps-up`, `deploy-backend-local`, …).

### 🟡 Phase 6 — Terraform Foundation (AWS) _(authored + validated — apply gated)_

- **Step 1** — ✅ `modules/network`: VPC, 2-AZ public + private subnets, IGW, single NAT (+EIP), public/private route tables + associations. `single_nat_gateway` toggle.
- **Step 2** — ✅ `modules/security`: EC2 SG (80/443 public, 22 + 6443 restricted via CIDR vars — **closed by default**), RDS SG (5432 from EC2 SG only), IAM role + instance profile (`AmazonEC2ContainerRegistryReadOnly` + `AmazonSSMManagedInstanceCore` + scoped S3 RW policy). **SSM = keyless host shell, port 22 stays shut.**
- **Step 3** — ✅ `modules/storage`: S3 bucket — versioning, AES256 SSE, `BucketOwnerEnforced`, full public-access block. (TF state bucket + DynamoDB lock = separate bootstrap, see `backend.tf`.)
- **Step 4** — ✅ `modules/database`: RDS PostgreSQL **18**, gp3 encrypted, private subnet group, `deletion_protection`, 7-day backups, final snapshot; outputs `address`/`port`/`connection_url` (sensitive).
- **Step 5** — ✅ `modules/compute`: EC2 K3s host (latest Ubuntu 22.04 AMI data source or override), IMDSv2-only, encrypted gp3 root, EIP, `user_data` var (wired Phase 7).
- **Step 6** — ✅ `environments/prod`: `providers.tf` (aws ~>5, default_tags), `backend.tf` (S3 partial config + bootstrap note), `variables.tf`, `main.tf` (AZ data source + module wiring), `outputs.tf`, `terraform.tfvars.example`. Secrets via `TF_VAR_db_password` / gitignored tfvars.
- **Step 7** — ✅ Verified: `terraform fmt` clean + `validate` → valid. **`terraform plan` run by developer (eu-central-1, creds live): 35 to add, 0 destroy** (34 base + SSM attachment). State = **local** (`backend.tf` S3 block commented out; migrate later). ⛔ `apply` = developer-run (deny-blocked for agent). `db_password` via `TF_VAR_db_password`; `s3_bucket_name` must be globally unique.

### 🟡 Phase 7 — Production K3s Cluster _(authored + wired + validated — apply gated)_

- **Step 1** — ✅ `infra/scripts/bootstrap-k3s.sh` (EC2 user-data): installs K3s `--disable traefik` + `--write-kubeconfig-mode 644`, Helm, kubectl shim, global `KUBECONFIG`; waits for node Ready then drops `/var/lib/k3s-bootstrap.done`.
- **Step 2** — ✅ Wired: `compute` module `user_data = file(bootstrap-k3s.sh)` in `environments/prod/main.tf`; validated; appears in plan (35 resources). ⏳ **`terraform apply` pending — developer-run** (EC2 + EIP + SG + RDS ~10min + VPC).
- **Step 3** — ✅ `infra/scripts/k3s-addons.sh` (ingress-nginx via `ingress-nginx-prod.yaml` — `LoadBalancer` on klipper, `externalTrafficPolicy: Local` for real client IP; + cert-manager `crds.enabled`). ClusterIssuer = Phase 12. **Fetch kubeconfig keylessly via `aws ssm start-session`** (needs `session-manager-plugin` locally), copy `/etc/rancher/k3s/k3s.yaml`, swap `127.0.0.1`→`k3s_public_ip`.
- **Step 4** — ⏳ Verify (after apply): `kubectl get nodes` → Ready; run `k3s-addons.sh`; pods up in `ingress-nginx`/`cert-manager`. Scripts `bash -n` + chmod; TF validated; plan reviewed.

### 🟡 Phase 8 — CI/CD (GitHub Actions → ECR) _(authored + validated — needs apply + repo config)_

- **Step 1** — ✅ AWS side in Terraform: `modules/registry` (ECR repo, IMMUTABLE tags, scan-on-push, AES256, untagged-expire lifecycle) + `modules/cicd` (GitHub **OIDC provider** + deploy role, trust scoped to `repo:OWNER/REPO:ref:refs/heads/main`, policy = ECR auth + push to the one repo). Wired into prod root; outputs `ecr_repository_url` + `gha_deploy_role_arn`. `terraform validate` passes.
- **Step 2** — ✅ `be/.github/workflows/ci.yml` `deploy` job (`needs: build`, push/main only): OIDC `configure-aws-credentials` → `amazon-ecr-login` → `docker build --target production` + push `:${{ github.sha }}` → checkout `infra` repo (PAT) → `yq -i '.image.tag=<sha>' helm/backend/values-prod.yaml` → commit + push. **No kubeconfig in CI.**
- **Step 3** — ⏭️ `fe` mirror deferred to Phase 11 (frontend chart doesn't exist yet).
- **Step 4** — ⏭️ Branch protection → Phase 13.
- **Step 5** — ⛔ Verify (needs: TF apply for ECR+role, repo secrets/vars, Phase 9 ArgoCD): push to `main` → image in ECR → tag commit in `infra` → ArgoCD syncs. **Required repo config**: secrets `AWS_DEPLOY_ROLE_ARN` (=`gha_deploy_role_arn`), `INFRA_REPO_TOKEN` (PAT w/ infra write); vars `AWS_REGION`, `ECR_REPOSITORY` (repo name), `INFRA_REPOSITORY` (`bardin-28/infra.tsyvinda.com`). Workflow + TF validated; `infra` remote now live (Phase 5 ✅).

### ✅ Phase 9 — GitOps (ArgoCD) _(loop verified on local k3d)_

- **Step 1** — ✅ `infra/scripts/argocd-install.sh`: Helm `argo/argo-cd`, idempotent, prints admin password + port-forward hint. `infra/helm/values/argocd.yaml` (`server.insecure` — TLS at ingress/port-forward). **Cluster-agnostic** (K3d local or K3s prod via current kube-context).
- **Step 2** — ✅ **App-of-apps** `infra/argocd/root.yaml` → watches `infra/argocd/apps/`, `automated` sync (`prune`+`selfHeal`).
- **Step 3** — ✅ `infra/argocd/apps/backend.yaml`: source `infra` repo, path `helm/backend`, `valueFiles: [values-prod.yaml]`, dest `default` ns, auto-sync + `CreateNamespace`.
- **Step 4** — ✅ `repoURL` = `git@github.com:bardin-28/infra.tsyvinda.com.git` (live). **Verified**: registered the private repo via an SSH-key `repository` Secret; ArgoCD authenticated + pulled. Prod = read-only deploy key (per `argocd/README.md`).
- **Step 5** — ✅ Wired to Phase 8: CI bumps `values-prod.yaml` tag → ArgoCD syncs. No `helm upgrade` from CI.
- **Step 6** — ✅ Local k3d stays script-based for fast iteration; ArgoCD also runs locally (proven).
- **Step 7** — ✅ **Verified live**: installed ArgoCD on k3d, synced an isolated test app from the private repo → Healthy pod; ArgoCD correctly surfaced a deliberate ingress-host collision. Loop confirmed end-to-end. (Prod app-of-apps `root.yaml` sync belongs on real K3s — not run on local to avoid clobbering the working stack.)

### 🟡 Phase 10 — Monitoring _(ArgoCD apps authored — sync needs cluster)_

- **Step 1** — ✅ `infra/argocd/apps/monitoring.yaml`: `kube-prometheus-stack` (pinned `65.5.0`) ArgoCD Application — Prometheus (7d retention, `serviceMonitorSelectorNilUsesHelmValues:false`) + Grafana + Alertmanager + node-exporter + kube-state-metrics. `ServerSideApply` (big CRDs). Grafana admin pw auto-generated to `monitoring-grafana` secret (none in git).
- **Step 2** — ⏭️ **Backend app-metrics deferred** — no `/metrics` endpoint; needs npm dep (`@willsoto/nestjs-prometheus`, **gated**). Node + k8s metrics flow now regardless; add `ServiceMonitor` once the endpoint exists.
- **Step 3** — ✅ `infra/argocd/apps/loki.yaml`: `grafana/loki-stack` (pinned `2.10.2`) — Loki + promtail (5Gi PV), bundled Grafana disabled. Loki datasource wired in `monitoring.yaml` (`additionalDataSources`). Backend pino JSON → field-queryable in Explore.
- **Step 4** — ✅ Grafana ships kube-prometheus default dashboards (infra: CPU/RAM/net). App dashboards follow Step 2.
- **Step 5** — 🟡 Alertmanager route + `default` receiver scaffolded; **Telegram + Email configs commented** (creds via Alertmanager/sealed Secret — never committed). Uncomment + supply secret to enable.
- **Step 6** — ⛔ Verify (needs cluster): drop into app-of-apps (root auto-syncs `apps/`), Grafana reachable, dashboards populated, test alert fires. Manifests YAML-validated. **Sizing caveat**: full stack + Loki + backend won't fit `t3.small` (2GB) — bump instance or trim for prod.

### ✅ Phase 11 — Frontend Deployment _(deployed + verified)_

- **Step 1** — ✅ `fe` Dockerfile exists (Next.js 16.2.3, `next start`, port 3000). **Not standalone** — left as-is (no opportunistic refactor). Key finding: frontend config (`API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) is **build-time** (build-args), not runtime — so per-env differences are baked at image build, not injected by ConfigMap.
- **Step 2** — ✅ `infra/helm/frontend` hand-authored: Deployment (envFrom ConfigMap, probes on `/` — Next has no `/health`), Service (ClusterIP 80→3000), ConfigMap (runtime `PORT`/`HOSTNAME`/`NODE_ENV` only). No Secret (frontend holds none; turnstile *site* key is public + baked).
- **Step 3** — ✅ `values-local.yaml` / `values-prod.yaml` (replicas 2, req/limits) + `infra/scripts/deploy-frontend-local.sh` (passes `--build-arg API_URL`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY` → import → helm) + `infra/argocd/apps/frontend.yaml` (auto-sync, prod). ⏭️ **`fe` CI mirror + frontend ECR repo = Phase 8 follow-up** (separate repo; build-args; needs second `module.registry` instance).
- **Step 4** — ✅ **Verified live**: `deploy-frontend-local.sh` built Next 16 image, imported, `helm install` → pod 1/1, rolled out. `helm lint` clean.

### ✅ Phase 12 — Ingress _(verified live — local)_

- **Decision** — **Subdomain routing** (matches built code: `BACKEND_HOST`, backend CORS allowlist, frontend `API_URL`). `tsyvinda.{local,com}` → frontend, `api.tsyvinda.{local,com}` → backend. _Not_ path-based.
- **Step 1** — ✅ Per-chart `templates/ingress.yaml` (backend + frontend), gated `ingress.enabled`, `ingressClassName: nginx`, host + TLS from values. Ingress values added to `values.yaml` (default off) + `values-local`/`values-prod` (hosts above).
- **Step 2** — ✅ TLS **local**: `infra/scripts/cert-secret.sh` — multi-SAN mkcert cert (`tsyvinda.local` + `api.tsyvinda.local`) → shared `tsyvinda-local-tls` secret both Ingresses reference; `mkcert -install` trusts it. Certs in gitignored `.certs/`. **Prod**: `infra/kubernetes/cluster-issuer-prod.yaml` (Let's Encrypt `letsencrypt-prod`) + `cert-manager.io/cluster-issuer` annotation auto-issues `*-tls` secrets. (Cloudflare: grey-cloud during HTTP-01, or switch to DNS-01.)
- **Step 3** — ✅ `app.set('trust proxy', 1)` correct behind ingress-nginx (`externalTrafficPolicy: Local` from Phase 7 preserves client IP). Revisit only if Cloudflare adds a hop.
- **Step 4** — ✅ **Verified live** (via `curl --resolve`, no `/etc/hosts` needed): `https://api.tsyvinda.local/health` → `{"status":"ok","db":true,"redis":true}` 200; `https://tsyvinda.local/` → 200. **`cert_verify=0`** — mkcert cert trusted end-to-end through ingress-nginx. (Browser use still needs the `/etc/hosts` map.)

### 🟡 Phase 13 — Production Hardening _(charts + runbook authored — runtime steps remain)_

- **Step 1** — ✅ Both charts: resource `requests`/`limits` (prod) + probes (Phase 3/11) + **`securityContext`** (no-priv-esc, drop ALL caps, seccomp RuntimeDefault; backend `runAsNonRoot` + **numeric `runAsUser:1000`** — required, verified live) + **`PodDisruptionBudget`** (`minAvailable:1`, prod). ⚠️ Frontend not `runAsNonRoot` — `fe` Dockerfile lacks `USER` (follow-up).
- **Step 2** — 🟡 RDS backups = 7d + deletion-protection (Terraform, done). **Pooling deferred** (RDS Proxy vs PgBouncer sidecar — decide near `db.t4g.micro` ~80-conn ceiling; documented).
- **Step 3** — ✅ `argocd/apps/sealed-secrets.yaml` (bitnami controller). Workflow in `hardening.md`: `kubeseal` → commit sealed file. Migrate backend Secret + ArgoCD SSH key + Alertmanager creds. ⛔ actual sealing = runtime.
- **Step 4** — ✅ Already hardened: SSH closed (SSM-only), RDS private, IAM scoped (EC2: ECR+SSM+1-bucket S3; GHA: OIDC+1-repo push from main). Review checklist in `hardening.md`.
- **Step 5** — ⛔ Branch protection (be/fe/infra) = runtime `gh api` (commands in `hardening.md`). Outward-facing — developer-run.
- **Step 6** — 🟡 Alert thresholds + receivers documented (`hardening.md`); enable Telegram/Email via sealed creds at runtime (ties Phase 10).
- **Step 7** — ✅ `infra/docs/hardening.md` = full runbook (resilience, DB, secrets, IAM, branch-protection, observability, follow-ups, E2E verification). ⛔ live E2E needs cluster + apply.

**Phase 13 follow-ups (out of plan scope):** fe `USER node`→runAsNonRoot; backend uploads ephemeral → S3/PVC; backend `/metrics`; TF state → S3 backend; fe CI/ECR mirror.

---

## Important Notes

- **Cross-repo writes** — Plan executed from `be`; `infra/` artifacts written to the sibling repo via `additionalDirectories` (`../infra`). `fe` is read/writable too (`../fe`).
- **Stale-plan corrections baked in** — Original `k3d-plan.md` said **Prisma** (→ TypeORM) and treated Phase 1 as greenfield (→ already built + deployed on DigitalOcean droplet). Canonical status tracker = `infra/docs/ROADMAP.md`.
- **Install gating** — Any new npm dep in `be`/`fe` (metrics client, etc.) and any new Helm chart pause for approval first. Per CLAUDE.md: "Don't install new packages without confirming first."
- **Apply gating** — `terraform apply`, `git init`, and anything that creates real AWS resources or costs money pause for explicit approval. `plan`/`validate` are safe and run freely.
- **Local ≠ prod deps** — In-cluster Postgres/Redis/MiniStack-S3 are **local-only** (K3d). Prod uses RDS + managed Redis + real AWS S3. Never point prod at in-cluster Postgres or MiniStack.
- **Secrets discipline** — `infra/.gitignore` already blocks `*.tfstate`, `*.tfvars`, `*.key`, `*.pem`, `kubeconfig`, `.env*`. Verify before every `infra` commit.
- **Postgres version lock** — Backend ties to Postgres 18 (volume format version-tied per CLAUDE.md). In-cluster chart + RDS must both be 18.
- **No traefik** — K3d/K3s ship traefik; disable it so ingress-nginx is the single ingress controller (parity with prod).

---

## Post-implementation follow-ups (out of scope)

- ArgoCD in local k3d (prod-parity GitOps locally).
- Horizontal Pod Autoscaler + multi-node K3s HA.
- EKS migration (charts already portable).
- OpenTelemetry distributed tracing.
- Blue/green or canary rollouts.
