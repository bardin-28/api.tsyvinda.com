# Report: S3 Uploads + K3d→K3s Infrastructure (INFRA-S3-001 / INFRA-K3D-001)

Consolidated status report for two linked workstreams:

1. **S3 uploads** — backend image storage migrated from local disk to S3 (MiniStack
   locally, real AWS S3 in prod). _Status: complete (Phases 1–5 ✅)._
2. **K3d→K3s infrastructure** — full platform: local K3d, prod K3s on AWS via
   Terraform, GitHub Actions → ECR, ArgoCD GitOps, Prometheus/Grafana/Loki.
   _Status: local stack live; AWS apply + prod GitOps gated on developer-run apply._

All infra artifacts live in the sibling `../infra` repo (written from `be` via
`additionalDirectories`). Canonical phase tracker = `infra/docs/ROADMAP.md`.

---

# Part 1 — S3 Uploads

## Goal
One S3 code path for backend image uploads (post + profile images): MiniStack locally,
real AWS S3 in prod via endpoint override. No `if local` branches.

## Architectural decisions
- **Emulator: MiniStack** (`ministackorg/ministack`, `:4566`, MIT, LocalStack-API-compatible).
  ~30MB/~2s vs LocalStack ~500MB/~15–30s — fits k3d alongside the full stack + ArgoCD.
  Not MinIO (OSS gutted), not LocalStack (core S3 moved behind paid plan).
- **SDK** `@aws-sdk/client-s3` v3 — `PutObjectCommand` / `DeleteObjectCommand`.
- **multer `diskStorage` → `memoryStorage`** — handler streams `file.buffer` to `S3Service`;
  no disk writes, no `uploads/` dirs, no static serving.
- **Key scheme** `posts/<uuid>.<ext>`, `profile/<uuid>.<ext>`.
- **URL** — store the full public URL in the existing `varchar` column (no schema change);
  deletion derives the key by stripping the public base.
- **Config** (`app.config.ts` zod) — `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT?`,
  `S3_ACCESS_KEY_ID?`, `S3_SECRET_ACCESS_KEY?`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE`.
  Prod omits `S3_ENDPOINT` + keys → SDK hits real AWS via the EC2 IAM role.
- **Cleanup** — memoryStorage means nothing on disk; the only delete case is replace/remove
  of a stored object → `S3Service.deleteByUrl` in the service layer (no CleanupUploadInterceptor).

## Phases (all ✅)
| Phase | What | Verify |
|---|---|---|
| 1 — MiniStack infra | `ministack` + `s3-init` (bucket + public-read) in compose; MiniStack Deployment/Service + bucket Job in k3d `local-deps.yaml` | live on k3d: bucket made, put/list/get round-trips |
| 2 — S3 client + config | `S3Service` (put/deleteByUrl/keyFromUrl) + global `S3Module`; `S3_*` zod config; `requestChecksumCalculation: WHEN_REQUIRED` | 111 tests, typecheck clean |
| 3 — Post images | `posts.controller` async + `S3Service`, `post.service` deleteByUrl on replace/remove | 113 tests, redeploy boots clean |
| 4 — Profile images | `users.controller`/`profile.service` same pattern; Turnstile kept after FileInterceptor | 115 tests |
| 5 — Cleanup | removed static serving (`index.ts`), `shared/upload.ts` (posts+users), `CleanupUploadInterceptor`, disk `imageUploadOptions`, Dockerfile `mkdir uploads`, compose upload volumes | 113 tests (−2 deleted), no lingering refs |

## Post-plan local refinements (this session)
- **Profile image clear → `DELETE /profile/image`** (separate endpoint). `PATCH /profile`
  only replaces (old object auto-deleted via `deleteByUrl`); the `removeImage` flag is gone.
- **Swagger** — documented `cf-turnstile-response` (required) on the 5 turnstile routes and the
  `image` binary field on the 3 multipart routes (reusable `ApiTurnstileToken()` / `ApiImageFile()`).
- **Local image serving via the api host** — images served at
  `https://api.tsyvinda.local/s3/<key>` through nginx-proxy (`docker/nginx-proxy/api.tsyvinda.local_location`,
  `proxy_pass http://ministack:4566/tsyvinda-local/`), bucket injected server-side →
  `S3_PUBLIC_URL=https://api.tsyvinda.local/s3` (bucket omitted from the URL). HTTPS via mkcert.
  Backend still PUTs/DELETEs via the internal `S3_ENDPOINT=http://ministack:4566`.
  **Local-only; prod `values-prod` / `config.s3` use the bucket/CDN host.**

## Notes / out of scope
- No schema change; only the stored URL value changed.
- Prod parity: same code path; EC2 IAM role grants `s3:Get/Put/DeleteObject`.
- MiniStack data is ephemeral (resets on pod/container restart).
- Out of scope: presigned URLs, CDN/CloudFront, image resizing, multipart/large files
  (5MB cap), migration of legacy `/uploads/...` rows.
- **Single-file bind-mount gotcha**: editing `api.tsyvinda.local_location` changes the inode →
  `docker compose up -d --force-recreate nginx-proxy` to rebind (plain restart shows stale content).

---

# Part 2 — K3d → K3s Infrastructure

## Goal
Stand up the full platform: containerized backend (`be`) + frontend (`fe`) on local **K3d**,
promoted to prod **K3s** on AWS EC2, provisioned by **Terraform**, deployed by **GitHub
Actions → ECR → ArgoCD**, observed by **Prometheus / Grafana / Loki**. EKS-migratable, no app changes.

## Architectural decisions
- **Helm for app workloads** — `infra/helm/{backend,frontend}`, one chart + `values-local.yaml`
  (K3d) / `values-prod.yaml` (K3s); only values + image tag differ → local≡prod parity.
- **Config split** — ConfigMap (non-secret) + Secret (sensitive), mounted as env; backend zod
  validates on boot (empty secret keys skipped → fail-fast surfaces the missing var).
- **Local deps in-cluster** — official `postgres:18-alpine` + `redis:8-alpine` + MiniStack S3
  (Bitnami public tags retired 2025). Prod uses managed **RDS + S3** (Terraform). Local-only.
- **ingress-nginx**, single controller both envs; traefik disabled. TLS: mkcert local /
  cert-manager + Let's Encrypt prod. **Subdomain routing**: `tsyvinda.*`→frontend, `api.tsyvinda.*`→backend.
- **Terraform** — modular (`network/security/storage/database/compute/registry/cicd`),
  consumed by `environments/prod`. **SSM Session Manager** = keyless host access (port 22 shut).
- **CI/CD** — GitHub Actions OIDC → ECR → bump image tag in `infra` git. No kubeconfig in CI.
- **GitOps** — ArgoCD app-of-apps watches `infra`, pull-reconciles (`prune`+`selfHeal`). Prod only.
- **Monitoring** — kube-prometheus-stack + Loki/promtail; Alertmanager → Telegram/Email.

## Phase status
| Phase | Status | Notes |
|---|---|---|
| 1 — Backend foundation | ✅ baseline | NestJS/TypeORM/PG18, already built |
| 2 — K3d local cluster | ✅ **live** | `api-tsyvinda-local`, K3s v1.35.5, traefik off |
| 3 — `helm/backend` | ✅ **live** | pod 1/1, `/health` 200 db+redis, non-root uid 1000 |
| 4 — Local deps (PG/Redis/MiniStack) | ✅ **live** | official images; `/health` db+redis true |
| 5 — Infra repo | 🟡 scaffold | git pushed to `bardin-28/infra.tsyvinda.com`; architecture.md TODO |
| 6 — Terraform AWS | 🟡 validated | `plan` = 35 add; **apply developer-run** (deny-gated) |
| 7 — Prod K3s | 🟡 wired | bootstrap+addons scripts; verify after apply |
| 8 — CI/CD (GHA→ECR) | 🟡 authored | needs TF apply + repo secrets/vars |
| 9 — ArgoCD GitOps | ✅ **loop verified** | synced private-repo test app → Healthy on local k3d |
| 10 — Monitoring | 🟡 authored | ArgoCD apps; sync needs cluster (sizing: >t3.small) |
| 11 — Frontend deploy | ✅ **live** | Next 16 pod 1/1; `API_URL` is build-time, not runtime |
| 12 — Ingress | ✅ **live** | subdomain routing, mkcert TLS trusted end-to-end |
| 13 — Hardening | 🟡 authored | securityContext/PDB/sealed-secrets; runtime steps remain |

## Required repo config (Phase 8, when applying)
- **Secrets**: `AWS_DEPLOY_ROLE_ARN` (=`gha_deploy_role_arn`), `INFRA_REPO_TOKEN` (PAT, infra write)
- **Variables**: `AWS_REGION`, `ECR_REPOSITORY`, `INFRA_REPOSITORY` (`bardin-28/infra.tsyvinda.com`)

## Key live-run fixes (baked in)
- Stale `k3d-dev` cluster held :80 → delete + recreate.
- Bitnami `postgresql:18` ImagePullBackOff → official `postgres:18-alpine`.
- `runAsNonRoot` needs numeric `runAsUser:1000` (image `USER node` unverifiable).
- Local `NODE_ENV=production` (prod image, no pino-pretty devDep) → `synchronize` OFF, run
  migrations to exercise data endpoints.
- Frontend `/api/*` 500 → Next bakes `rewrites()` at build; `API_URL` must be the in-cluster
  service (`http://backend.default.svc.cluster.local`), not the public host.
- MiniStack rejects CRC64NVME → `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`.

## Notes
- **Local ≠ prod deps** — in-cluster PG/Redis/MiniStack are local-only; never point prod at them.
- **Apply gating** — `terraform apply` / real AWS resource creation = developer-run; `plan`/`validate` free.
- **Secrets discipline** — `infra/.gitignore` blocks `*.tfstate`/`*.tfvars`/`*.key`/`*.pem`/`kubeconfig`/`.env*`.
- **No new npm/Helm** without approval.

## Out of scope / follow-ups
- HPA + multi-node K3s HA; EKS migration; OpenTelemetry tracing; blue/green rollouts.
- fe `USER node`→runAsNonRoot; backend `/metrics`; TF state → S3 backend; fe CI/ECR mirror.
