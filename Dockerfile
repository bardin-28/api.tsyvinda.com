ARG BUILD_JOBS=1

FROM node:22-alpine AS base
WORKDIR /app
ARG BUILD_JOBS
ENV MAKEFLAGS="-j${BUILD_JOBS}" UV_THREADPOOL_SIZE=${BUILD_JOBS} NODE_OPTIONS="--max-old-space-size=1024"
COPY package*.json ./

FROM base AS development
ENV NODE_ENV=development
RUN npm install --no-audit --no-fund
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund
COPY . .
RUN nice -n 10 npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
ARG BUILD_JOBS
ENV UV_THREADPOOL_SIZE=${BUILD_JOBS}
RUN apk add --no-cache curl tini
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
