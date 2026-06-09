# Plan: Blog Posts Module

## Goal

Add a `posts` feature module exposing CRUD endpoints for blog posts (`POST /posts`, `GET /posts`, `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`) with cursor pagination on list and optional image upload, following the project's module/routes/services/entities/shared layout.

---

## Requirements

- **POST /posts** — create a post. Body: `title`, `description`, `htmlContent`; optional multipart `image` (jpeg/png/webp, ≤5MB). Author = authenticated user.
- **GET /posts** — list posts with cursor pagination ordered by `(createdAt DESC, id DESC)`. Default `limit=20`, max `limit=50`. Response shape `{ items, nextCursor }`. Public (no auth).
- **GET /posts/:id** — fetch single post. Public. 404 when missing.
- **PATCH /posts/:id** — partial update (same fields as POST, all optional). Multipart with optional `image` (replaces and unlinks prior file). Only the author may update (403 otherwise).
- **DELETE /posts/:id** — hard delete + unlink stored image. Only the author may delete.
- Use `requireAuth` from `auth/middleware/is-authenticated` for POST/PATCH/DELETE; GET routes are public.
- HTML content trusted but length-capped (≤100 000 chars) and never sanitized server-side.
- Image upload lives at `uploads/posts/` (mirroring profile pattern) and is exposed at `/uploads/posts/<filename>`.
- Add Docker volume `post-uploads` mounted at `/app/uploads/posts` in `docker-compose.yml` + `docker-compose.prod.yml`. Dockerfile creates the dir and chowns to `node`.
- Swagger `@openapi` blocks on every route file; rely on existing glob `modules/**/routes/*.{ts,js}`.
- Vitest tests cover create/list/get/patch/delete happy + 403/404 paths.

---

## Architectural decisions

- **Entity location** — `src/modules/posts/entities/post.entity.ts`. UUID PK, `varchar(200)` title, nullable `varchar(500)` description, `text` htmlContent, nullable `varchar(1024)` imageUrl, `authorId` FK to `users.id` `ON DELETE CASCADE`. `CreateDateColumn`/`UpdateDateColumn` for timestamps. Composite index on `(createdAt, id)` to back keyset pagination.
- **Cursor format** — `base64url(JSON.stringify({ createdAt: ISO, id: uuid }))`. Decoded by service; opaque to clients. Order is `createdAt DESC, id DESC` (id breaks ties at the same millisecond).
- **Pagination query** — TypeORM QueryBuilder with `WHERE (createdAt, id) < ($cursorCreatedAt, $cursorId)` (tuple comparison emulated via `(createdAt < :c OR (createdAt = :c AND id < :id))`) limited to `limit + 1`. Extra row triggers `nextCursor`, else null.
- **Author embed** — `toPublicAuthor` projects a subset of `User` (id, firstName, lastName, profileImageUrl). Defined locally inside `posts.service` to keep posts module independent of auth's `PublicUser` (still uses `User` entity type from `users/entities/user.entity` for typing). Single source of truth for the shape avoids polluting auth.
- **Upload helper** — separate `src/modules/posts/shared/upload.ts` mirroring `users/shared/upload.ts`. Constants: `UPLOAD_DIR = uploads/posts`, `POST_IMAGE_URL_PREFIX = /uploads/posts`. Field name `image`. Same MIME allow-list and 5MB cap.
- **Image lifecycle** — on PATCH replacement and DELETE, best-effort `unlink` of the old file (`safeUnlink` helper). Failure to unlink does not fail the request.
- **Validation** — zod schemas in `src/modules/posts/entities/post.schema.ts`: `createPostSchema`, `updatePostSchema`, `listQuerySchema` (limit + cursor). All mounted via existing `validate` middleware.
- **Multipart parsing order** — multer first (populates `req.body` + `req.file`), then `validate` (zod on body). PATCH requires at least one updated field OR an image (mirrors profile rule).
- **Service** — `PostService` class with lazy `getRepository(Post)` + `getRepository(User)` (User repo used to populate author for responses). Exposes `create`, `list`, `getById`, `update`, `remove`.
- **Status codes** — 201 for create, 200 for list/get/patch, 204 for delete, 404 `POST_NOT_FOUND`, 403 `FORBIDDEN` for non-author edit/delete, 400 `VALIDATION_FAILED`, 401 `UNAUTHENTICATED`, 413 `FILE_TOO_LARGE`, 400 `INVALID_FILE_TYPE`.
- **Sync vs migration** — dev relies on `synchronize: true`. No new migration file for now; production deploy will need one generated separately (out of scope per ARGUMENTS).
- **Mount point** — `app.use('/posts', postsRouter)` in `src/app.ts`, after the existing `/profile` mount. Static serve `app.use('/uploads/posts', express.static(...))` mirroring the profile static mount.

---

## Implementation Checklist

### ☑ Phase 1 — Entity, schema, upload helper

- **Step 1** — Create `src/modules/posts/entities/post.entity.ts` with the `Post` class (uuid PK, columns, FK to `User`, composite index `posts_created_id_idx` on `[createdAt, id]`).
- **Step 2** — Create `src/modules/posts/entities/post.schema.ts` with `createPostSchema`, `updatePostSchema`, `listQuerySchema`, exported types.
- **Step 3** — Create `src/modules/posts/shared/upload.ts` with `postImageUpload` middleware, `UPLOAD_DIR`, `POST_IMAGE_URL_PREFIX`, reusing the same MIME map + size cap as the profile helper.

### ☑ Phase 2 — Service layer

- **Step 1** — Create `src/modules/posts/services/post.service.ts` with `PostService` class. Lazy `posts` / `users` getters via `AppDataSource.getRepository`. Methods: `create(authorId, input, imageUrl?)`, `list({ limit, cursor })`, `getById(id)`, `update(id, authorId, patch)`, `remove(id, authorId)`.
- **Step 2** — Implement cursor encode/decode (`encodeCursor`, `decodeCursor`). Invalid cursor → `HttpError(400, 'INVALID_CURSOR')`.
- **Step 3** — Implement `toPublicAuthor(user)` projection and `toPublicPost(post, author)` response shape.

### ☑ Phase 3 — Route files

- **Step 1** — `src/modules/posts/routes/list.ts` — GET `/` (public). `validate({ query: listQuerySchema })`. Returns `{ items, nextCursor }`. Swagger block.
- **Step 2** — `src/modules/posts/routes/get.ts` — GET `/:id` (public). Returns single post or 404.
- **Step 3** — `src/modules/posts/routes/create.ts` — POST `/` (requireAuth → `postImageUpload` → `validate({ body: createPostSchema })`). Returns 201 + post. Cleans up file on service failure.
- **Step 4** — `src/modules/posts/routes/update.ts` — PATCH `/:id` (requireAuth → upload → validate). 403 when caller is not author; 404 missing. Replaces image, unlinks prior.
- **Step 5** — `src/modules/posts/routes/delete.ts` — DELETE `/:id` (requireAuth). 403/404 as above. Unlinks image, returns 204.

### ☑ Phase 4 — Wiring

- **Step 1** — Create `src/modules/posts/posts.routes.ts` to mount the five route files under `/`.
- **Step 2** — Update `src/app.ts`: import `postsRouter` and `UPLOAD_DIR` from posts; mount static `/uploads/posts` (same headers as profile) and `app.use('/posts', postsRouter)`.

### ☑ Phase 5 — Docker / infra

- **Step 1** — `Dockerfile`: extend `mkdir -p && chown` line to also create `/app/uploads/posts`.
- **Step 2** — `docker-compose.yml` + `docker-compose.prod.yml`: add named volume `post-uploads` and mount it at `/app/uploads/posts` on the `app` service.

### ☑ Phase 6 — Tests

- **Step 1** — Create `src/modules/posts/posts.routes.test.ts` mocking `db/database`, `redis/redis`, and `./services/post.service`. Cover: POST 201, GET list with cursor (returns nextCursor when extra row present), GET 404, PATCH 403 non-author, PATCH 200 author, DELETE 403 non-author, DELETE 204 author, invalid cursor → 400.
- **Step 2** — Run `npm run typecheck` and `npm test`. Both must be green.

### ☑ Phase 7 — Report

- **Step 1** — Write `reports/posts.md` summarizing the structure, decisions, and test results.

---

## Important Notes

- **No new dependencies.** Multer, zod, supertest, vitest are already installed. No package.json change.
- **No DB migration generated** — relies on dev `synchronize`. Out of scope for this task per ARGUMENTS.
- **Author edits only.** Admin/moderator override is not in scope. 403 returned for any other user.
- **GET endpoints are public** — emphasizes that list/get pages should not require an account.
- **TypeORM glob already covers `modules/**/\*.entity.{ts,js}`\*\* so the new entity is auto-discovered.
- **Swagger glob already covers `modules/**/routes/\*.{ts,js}`** so per-endpoint files appear in `/docs`.
