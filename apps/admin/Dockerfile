# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/admin/Dockerfile --build-arg ADMIN_PUBLIC_API_URL=... .
# Vite bakes ADMIN_PUBLIC_* at build time — images are per-environment, not promotable.

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack prompts before downloading pnpm — no TTY in docker build, so it hangs
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Local dev (docker compose): Vite dev server behind nginx-proxy; src is bind-mounted for HMR.
# Own install inside the image: host node_modules hold macOS-native binaries.
FROM base AS development
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
WORKDIR /repo/apps/admin
CMD ["pnpm", "exec", "vite"]

FROM base AS build

ARG ADMIN_PUBLIC_API_URL
ENV ADMIN_PUBLIC_API_URL=$ADMIN_PUBLIC_API_URL

WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@tsyvinda/admin

# Unprivileged variant: nginx runs as uid 101 on :8080 and writes only to /tmp, so the
# pod runs non-root with a read-only root filesystem (infra helm/admin).
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
    CMD wget -qO- http://127.0.0.1:8080/ || exit 1
