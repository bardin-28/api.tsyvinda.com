# Report: Blog Posts Module

## Outcome

Added a `posts` feature module with full CRUD endpoints, cursor-based listing, and per-post image upload. All endpoints reachable, all tests green.

- Endpoints: `GET /posts`, `GET /posts/:id`, `POST /posts`, `PATCH /posts/:id`, `DELETE /posts/:id`.
- Cursor pagination (base64url JSON, `createdAt DESC, id DESC` keyset).
- Image upload to `uploads/posts/` (multer, jpeg/png/webp ≤5MB), served at `/uploads/posts/<file>`.
- Author-only edit/delete (403 otherwise). Public reads.

---

## Final structure

```
src/modules/posts/
  posts.routes.ts                     mounts list/create/get/update/delete at /
  posts.routes.test.ts                Vitest, 17 cases
  entities/
    post.entity.ts                    Post (uuid, varchar(200) title, varchar(500) description nullable, text htmlContent, varchar(1024) imageUrl nullable, FK authorId → users CASCADE, timestamps; idx (createdAt, id) and (authorId))
    post.schema.ts                    createPostSchema, updatePostSchema, listQuerySchema (limit 1-50, cursor optional)
  services/
    post.service.ts                   PostService class + encodeCursor/decodeCursor + toPublicAuthor/toPublicPost
  shared/
    upload.ts                         postImageUpload (multer), UPLOAD_DIR=uploads/posts, POST_IMAGE_URL_PREFIX=/uploads/posts
  routes/
    list.ts                           GET /              validate(listQuerySchema) → postService.list
    get.ts                            GET /:id           postService.getById (404)
    create.ts                         POST /             requireAuth → upload → validate → postService.create (201)
    update.ts                         PATCH /:id         requireAuth → upload → validate → postService.update (200/403/404)
    delete.ts                         DELETE /:id        requireAuth → postService.remove (204/403/404)
```

---

## Phase results

### ☑ Phase 1 — Entity, schema, upload helper

- Created `post.entity.ts` with composite index on `(createdAt, id)` and FK `authorId → users.id ON DELETE CASCADE`.
- Created `post.schema.ts` (zod) with three schemas. `htmlContent` length capped at 100 000 chars; no sanitization (per requirements).
- Created `shared/upload.ts` mirroring `users/shared/upload.ts` with separate `UPLOAD_DIR`. Same MIME map + 5MB cap.
- Typecheck: clean.

### ☑ Phase 2 — Service layer

- `PostService` with lazy `posts` / `users` getters via `AppDataSource.getRepository`.
- `list` uses TypeORM QueryBuilder, `innerJoinAndMapOne` for `author`, keyset filter `(createdAt < c OR (createdAt = c AND id < id_c))`, fetches `limit + 1` to compute `nextCursor`.
- `encodeCursor` / `decodeCursor` are exported and validated (invalid → `HttpError(400, 'INVALID_CURSOR')`).
- `update` and `remove` enforce author ownership; on image replacement / deletion the prior file is `unlink`ed best-effort.

### ☑ Phase 3 — Route files

- 5 route files, one per endpoint, each carrying its `@openapi` block (picked up by the swagger glob `modules/**/routes/*.{ts,js}` added in the earlier swagger fix).
- POST/PATCH controllers clean up the uploaded file when the underlying service call throws (no orphan blobs on validation/permission errors).
- PATCH guards against empty payload (no fields and no image → 400 `VALIDATION_FAILED`).
- Added swagger component schemas: `Post`, `PostAuthor`, `PostList`.

### ☑ Phase 4 — Wiring

- `posts.routes.ts` mounts the 5 route files at `/`. Order: list → create → get → update → delete (specific paths before `/:id` to avoid ambiguity).
- `src/app.ts`: imported `postsRouter` + posts `UPLOAD_DIR` (aliased as `POST_UPLOAD_DIR` to avoid collision with profile dir). Added static mount at `/uploads/posts` (CORP cross-origin + immutable cache). Registered `app.use('/posts', postsRouter)` after `/profile`.

### ☑ Phase 5 — Docker / infra

- `Dockerfile` (production stage): extended `mkdir` to also create `/app/uploads/posts` before `chown`.
- `docker-compose.yml` + `docker-compose.prod.yml`: added named volume `post-uploads`, mounted at `/app/uploads/posts` on the `app` service.

### ☑ Phase 6 — Tests

- 17 new cases in `posts.routes.test.ts`. Mocks `db/database`, `redis/redis`, and `./services/post.service` (via `importActual` to keep real `encodeCursor`/`decodeCursor` available).
- Cases:
  - POST 401 unauth · 201 valid · 400 missing title
  - GET list: items + nextCursor · cursor forwarded · 400 limit>50 · INVALID_CURSOR propagated
  - GET /:id 200 · 404
  - PATCH 401 unauth · 200 author · 403 non-author · 400 empty
  - DELETE 401 unauth · 204 author · 403 non-author · 404 missing
- Suite result: `9 files / 78 tests passed`.
- `npm run typecheck`: clean.

### ☑ Phase 7 — Report

- This document.

---

## Decisions worth flagging

- **HTML not sanitized.** `htmlContent` is trusted because POST/PATCH require authentication and only the author can edit. Length capped at 100 000 chars to bound payload size. If untrusted authors are ever introduced, run server-side sanitization (DOMPurify on JSDOM or sanitize-html) before persisting.
- **Cursor opacity.** Cursor is `base64url(JSON)` but contains plaintext `createdAt`+`id`. Treat as opaque from a client perspective; values are derivable from list output so confidentiality is not relevant.
- **Author embed is local to posts.** `PublicAuthor` is defined inside `post.service.ts` rather than imported from auth's `PublicUser`. Keeps the posts module decoupled from auth's response shape.
- **No DB migration generated.** Dev relies on TypeORM `synchronize: true`. Prod deploy requires a separate `db:migration:generate` run against a synced dev schema and a commit before rollout. Not handled in this task per ARGUMENTS.
- **List ordering.** `(createdAt DESC, id DESC)` so `id` breaks ties when two posts share the same millisecond. The composite index supports this scan; for very large tables consider switching to BRIN on `createdAt` instead.
- **GET endpoints are public.** No global rate limiter override; the app-wide `buildRateLimiter()` middleware already covers them.

---

## Suggested follow-ups (not implemented)

- Generate and commit the TypeORM migration for the `posts` table before production deploy.
- Add server-side HTML sanitization if/when posts can be authored by untrusted users.
- Consider integration tests against a real Postgres (current tests mock the repository layer).
- Author profile updates currently do not propagate into cached `post.author` snapshots — but since `list`/`getById` always re-`JOIN`s users, the author payload is always fresh, so no action needed.

---

## Files changed

```
A  src/modules/posts/entities/post.entity.ts
A  src/modules/posts/entities/post.schema.ts
A  src/modules/posts/services/post.service.ts
A  src/modules/posts/shared/upload.ts
A  src/modules/posts/routes/list.ts
A  src/modules/posts/routes/get.ts
A  src/modules/posts/routes/create.ts
A  src/modules/posts/routes/update.ts
A  src/modules/posts/routes/delete.ts
A  src/modules/posts/posts.routes.ts
A  src/modules/posts/posts.routes.test.ts
M  src/app.ts                       mounted /posts + static /uploads/posts, aliased UPLOAD_DIR
M  src/shared/swagger.ts            added Post / PostAuthor / PostList component schemas
M  Dockerfile                       mkdir + chown for uploads/posts
M  docker-compose.yml               post-uploads volume + mount
M  docker-compose.prod.yml          post-uploads volume + mount
A  plans/posts.md
A  reports/posts.md
```
