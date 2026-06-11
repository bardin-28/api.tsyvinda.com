# Plan: Local S3 (MiniStack) + Backend S3 Uploads (INFRA-S3-001)

## Goal

Give local development a real S3 (MiniStack) and migrate backend image uploads
(post images, profile images) from local-disk multer storage to S3 — one code path
that points at MiniStack locally and real AWS S3 in prod via endpoint override.

---

## Requirements

- Local emulator: **MiniStack** S3 (`ministackorg/ministack`, `:4566`), usable from
  `npm run dev` (docker-compose) and from k3d (in-cluster pod).
- Backend uses **one** S3 client; environment selects target (no `if local` branches).
- Prod = real AWS S3 (Terraform bucket already exists, `module.storage`); local = MiniStack.
- Preserve the public response shape (`imageUrl` / `profileImageUrl` stay absolute URLs).
- No schema change — `posts.imageUrl` / `users.profileImageUrl` stay `varchar` (value
  semantics change from `/uploads/...` path to an S3 URL).
- New dependency requires approval before install (`@aws-sdk/client-s3`).
- Stop after each phase for review. **Do not commit.**

---

## Architectural decisions

- **Emulator: MiniStack** — MIT-licensed, LocalStack-API-compatible (`:4566`, `test`/`test`,
  same `aws --endpoint-url` commands). Chosen over LocalStack (core S3 moved behind a paid
  plan) and MinIO (OSS gutted). **~30MB idle / ~2s startup vs LocalStack ~500MB / ~15-30s** —
  matters because the local k3d already runs the full stack + ArgoCD; the heavier LocalStack
  image starved the cluster API in testing.
- **SDK: `@aws-sdk/client-s3`** (v3) — `PutObjectCommand` / `DeleteObjectCommand`. No
  presigner initially (objects served by a public base URL).
- **multer: `diskStorage` → `memoryStorage`** — handler gets `file.buffer`; `S3Service`
  uploads it. Removes disk writes, the `uploads/` dirs, and static serving.
- **Key scheme** — `posts/<uuid>.<ext>`, `profile/<uuid>.<ext>` (mirrors current dirs).
- **URL build** — store the **full URL** in the column (least churn): `imageUrl =
  ${S3_PUBLIC_URL}/${key}`. `S3_PUBLIC_URL` = `http://localhost:4566/<bucket>` (local) /
  `https://<bucket>.s3.<region>.amazonaws.com` (prod). Deletion derives the key from the
  stored URL (strip the base) → `DeleteObjectCommand`.
- **Config** (`app.config.ts` zod) — add `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT?`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` (bool).
  Prod omits `S3_ENDPOINT` → SDK hits real AWS; the EC2 IAM role already grants S3 RW.
- **CleanupUploadInterceptor** — with memoryStorage nothing is written to disk, so error-
  before-upload leaves nothing. The only cleanup case is handler failure *after* a successful
  S3 put (e.g. DB error) → `S3Service` deletes the just-uploaded object in the service layer.

---

## Implementation Checklist

### ✅ Phase 1 — MiniStack infra (no backend code) _(verified live on k3d)_

- **Step 1** — ✅ `docker-compose.yml`: `ministack` service (`ministackorg/ministack`,
  `127.0.0.1:4566`, persisted volume `localstack-data`→`ministack-data`) on `app-backend`.
- **Step 2** — 🟡 Bucket bootstrap: a one-shot `s3-init` (aws-cli) `mb` + public-read policy
  on the dev bucket (replaces the LocalStack-specific init-hook mount).
- **Step 3** — ✅ k3d `infra/kubernetes/local-deps.yaml`: MiniStack Deployment+Service
  (`:4566`, **tcpSocket** readiness) + bucket-create Job (`aws --endpoint-url`).
- **Step 4** — ⛔ `.env.example`: add the `S3_*` vars (permission-blocked for the agent —
  developer adds; block provided in chat / `local-access.md`).
- **Step 5** — ✅ Verified on k3d: MiniStack pod Running, `ministack-bucket-init` Job
  Complete (`make_bucket: tsyvinda-local`), `s3 ls` shows the bucket, and put/list/get of a
  test object round-trips (with `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`).

### ✅ Phase 2 — Backend S3 client + config _(done — 111 tests green, typecheck clean)_

- **Step 1** — ✅ Installed `@aws-sdk/client-s3` `3.1066.0`.
- **Step 2** — ✅ `app.config.ts`: `S3_*` zod schema + `config.s3`. `S3_BUCKET`+`S3_PUBLIC_URL`
  required; `S3_REGION` default; `S3_ENDPOINT`/keys optional (prod = IAM role). Wired test env
  (`vitest.config.ts`, `app.config.test.ts`). Backend chart values-local (MiniStack) +
  values-prod (real S3) updated.
- **Step 3** — ✅ `src/shared/s3/s3.service.ts` (`@Injectable`): `S3Client`
  (`endpoint`/`forcePathStyle` from config), `put(key, buffer, contentType)`,
  `delete(url)` (derives key from `S3_PUBLIC_URL`). Global `S3Module`.
  **MiniStack checksum gotcha (verified live):** newer AWS clients default to a
  `CRC64NVME` request checksum that MiniStack rejects (it supports SHA256/SHA1/CRC32).
  Set `requestChecksumCalculation: 'WHEN_REQUIRED'` on the `S3Client` (or `CRC32`) so
  local uploads work; harmless against real AWS.
- **Step 4** — ✅ `s3.service.test.ts` (mocked SDK): `put` returns public URL + sends
  `PutObjectCommand`; `keyFromUrl` matches only own base; `deleteByUrl` sends/no-ops
  correctly. (Live MiniStack put/delete already proven via aws-cli in Phase 1.)

### ✅ Phase 3 — Wire post images _(done — 113 tests green, redeploy boots clean)_

- **Step 1** — ✅ `upload-options.ts`: `imageUploadMemoryOptions()` (memoryStorage, shared
  `imageFileFilter`, 5MB) + exported `extForMime()`. Disk variant kept for profile (Phase 4).
- **Step 2** — ✅ `posts.controller`: `async create`/`update`, inject `S3Service`,
  `key = posts/${randomUUID()}.${extForMime(mime)}` → `await s3.put(buffer)` → stored URL.
  Dropped `CleanupUploadInterceptor` + `config.backendHost` URL building.
- **Step 3** — ✅ `post.service`: injected `S3Service`; `safeUnlinkByUrl` (disk) → 
  `this.s3.deleteByUrl(prevImage)` on update/delete; removed `fs`/`path`/`UPLOAD_DIR`.
- **Step 4** — ✅ `posts.controller.test.ts`: `S3Service` mock; new tests — image upload calls
  `s3.put(posts/<uuid>.png, Buffer, image/png)` + passes returned URL; non-image rejected 400.
- **Verify** — ✅ Rebuilt backend image, redeployed: pod 1/1, S3 env wired
  (`S3_ENDPOINT`→ministack svc), no boot errors, `/health` probe green. (Full multipart-
  through-auth upload = manual check; logic covered by tests + MiniStack proven in Phase 1.)

### ✅ Phase 4 — Wire profile images _(done — 115 tests green, typecheck clean)_

- **Step 1** — ✅ `users.controller`: `async update`, inject `S3Service`,
  `key = profile/${randomUUID()}.${extForMime(mime)}` → `await s3.put(buffer)` → stored URL.
  Switched to `imageUploadMemoryOptions()`; dropped `CleanupUploadInterceptor` (memoryStorage =
  no disk to clean) + `config.backendHost`/`PROFILE_IMAGE_URL_PREFIX` URL building.
  **`TurnstileInterceptor` kept, still AFTER `FileInterceptor`** (multer populates `req.body`).
- **Step 2** — ✅ `profile.service`: injected `S3Service`; `deletePriorImage` (disk `unlink`) →
  `this.s3.deleteByUrl(prevImage)` on replace; removed `fs`/`path`/`UPLOAD_DIR` imports.
- **Step 3** — ✅ `users.controller.test.ts`: `S3Service` mock + 2 new tests — image upload
  calls `s3.put(profile/<uuid>.png, Buffer, image/png)` + passes returned URL; non-image → 400.
- **Note** — `users/shared/upload.ts` (`UPLOAD_DIR`, `PROFILE_IMAGE_URL_PREFIX`) now unused by
  controller/service but still referenced by `index.ts` static serving → removed in Phase 5.

### ✅ Phase 5 — Cleanup + remove disk serving _(done — 113 tests green, typecheck clean)_

- **Step 1** — ✅ `index.ts`: removed both `useStaticAssets` blocks, the `staticHeaders`
  helper, and the `UPLOAD_DIR`/`*_IMAGE_URL_PREFIX` imports.
- **Step 2** — ✅ Deleted `modules/users/shared/upload.ts`, `modules/posts/shared/upload.ts`
  (+ empty `shared/` dirs), `shared/cleanup-upload.interceptor.ts` (+ its test). Removed the
  disk `imageUploadOptions(dir)` variant from `upload-options.ts` (memory variant only now;
  dropped `fs`/`diskStorage`/`randomUUID` imports). Removed the `mkdir /app/uploads` Dockerfile
  line + the `profile-uploads`/`post-uploads` docker-compose volumes & mounts.
- **Step 3** — ✅ `npm run typecheck` clean; `npx vitest run` → **113 passed** (was 115; −2 from
  the deleted cleanup-interceptor test). No lingering refs (grep clean). Manual MiniStack
  round-trip already proven in Phase 1.
- **Step 4** — ✅ Updated `CLAUDE.md` (layout `s3/`, boot line, File-upload note → memoryStorage
  + S3) and `infra/docs/local-access.md` (MiniStack row, S3 access subsection, creds). Fixed the
  stale `readOnlyRootFilesystem` comment in `helm/backend/values.yaml`.

---

## Important Notes

- **Install gating** — Phase 2 pauses for `@aws-sdk/client-s3` approval before `npm install`.
- **No schema change** — only the value stored in the existing URL columns changes.
- **Prod parity** — same code path; prod uses the Terraform S3 bucket + EC2 IAM role
  (already `s3:GetObject/PutObject/DeleteObject` scoped). Set `S3_PUBLIC_URL` to the bucket
  (or a CDN) and omit `S3_ENDPOINT`.
- **Ephemeral local** — MiniStack data resets unless the volume persists; fine for dev.
- **Resource note** — MiniStack's small footprint is why it replaced LocalStack here; the
  local k3d runs app + deps + ArgoCD on one node and can't spare ~500MB for an emulator.

---

## Out of scope

- Presigned upload/download URLs, CDN/CloudFront, image resizing/thumbnails.
- Multipart/large-file uploads (5MB cap unchanged).
- Migration of existing `/uploads/...` rows (prod never ran disk storage).
