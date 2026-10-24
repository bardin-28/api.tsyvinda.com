# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/admin/Dockerfile --build-arg ADMIN_PUBLIC_API_URL=... .
# Vite bakes ADMIN_PUBLIC_* at build time — images are per-environment, not promotable.

FROM node:22-alpine AS base
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

FROM nginx:1.27-alpine AS runtime
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
    CMD wget -qO- http://127.0.0.1:80/admin/ || exit 1
