# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/api/Dockerfile --target production .
ARG BUILD_JOBS=1

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack prompts before downloading pnpm — no TTY in docker build, so it hangs
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
ARG BUILD_JOBS
ENV MAKEFLAGS="-j${BUILD_JOBS}" UV_THREADPOOL_SIZE=${BUILD_JOBS} NODE_OPTIONS="--max-old-space-size=1024"

FROM base AS development
ENV NODE_ENV=development
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@tsyvinda/api^...
WORKDIR /repo/apps/api
CMD ["pnpm", "run", "dev"]

FROM base AS builder
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN nice -n 10 pnpm turbo run build --filter=@tsyvinda/api
# --legacy: the workspace doesn't use injected dependencies (inject-workspace-packages)
RUN pnpm --filter=@tsyvinda/api --prod deploy --legacy /prod/api

FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
ARG BUILD_JOBS
ENV UV_THREADPOOL_SIZE=${BUILD_JOBS}
RUN apk add --no-cache curl tini
COPY --from=builder --chown=node:node /prod/api /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
