#!/bin/sh
set -e

# Runs via nginx's /docker-entrypoint.d/ hook BEFORE nginx starts.
# Regenerates the runtime config from environment variables so the same image
# works in any environment without a rebuild. Defaults point at the public
# production API (api.aetern.de).
: "${API_BASE:=https://api.aetern.de}"
: "${WS_BASE:=wss://api.aetern.de}"
: "${API_VERSION:=v2}"
: "${BRAND:=AMORA}"

cat > /usr/share/nginx/html/config.js <<EOF
window.AETERN_CONFIG = {
  apiBase: "${API_BASE}",
  wsBase: "${WS_BASE}",
  apiVersion: "${API_VERSION}",
  brand: "${BRAND}",
};
EOF

echo "[amora-frontend] config.js -> API_BASE=${API_BASE} WS_BASE=${WS_BASE} API_VERSION=${API_VERSION}"
# No exec here: nginx's own entrypoint starts the server after this hook.
