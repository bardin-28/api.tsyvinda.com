#!/usr/bin/env bash
# mkcert TLS pairs for the local nginx-proxy: one per vhost (API, admin, fe), named <host>.crt/.key.
set -euo pipefail
cd "$(dirname "$0")/.."

env_value() { grep "^$1=" .env | cut -d= -f2- || true; }
BACKEND_HOST="$(env_value BACKEND_HOST)"
ADMIN_HOST="$(env_value ADMIN_HOST)"
# fe (../fe `npm run dev:local`) served through the fe-proxy compose service
FRONTEND_LOCAL_HOST="$(env_value FRONTEND_LOCAL_HOST)"
FRONTEND_LOCAL_HOST="${FRONTEND_LOCAL_HOST:-tsyvinda.local}"

mkdir -p nginx-certs
mkcert -install
for host in $BACKEND_HOST $ADMIN_HOST $FRONTEND_LOCAL_HOST; do
  mkcert -key-file "nginx-certs/$host.key" -cert-file "nginx-certs/$host.crt" "$host" localhost 127.0.0.1 ::1
done
