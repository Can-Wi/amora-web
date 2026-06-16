# AMORA web client — static SPA served by nginx.
# No build step (vanilla ES modules); the image just bundles the static files.
FROM nginx:1.27-alpine

# nginx site config (listens on :3000, SPA fallback, healthcheck)
# Note: this is the container-internal port. Coolify's Traefik routes to it by
# domain (app.aetern.de); it does not bind a host port, so there is no conflict
# with the API container which also uses 3000 internally.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# App files
COPY index.html config.js /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY assets/ /usr/share/nginx/html/assets/

# Runtime config injection from env vars (API_BASE / WS_BASE / API_VERSION)
COPY docker-entrypoint.sh /docker-entrypoint.d/40-amora-config.sh
RUN chmod +x /docker-entrypoint.d/40-amora-config.sh

EXPOSE 3000

# nginx:alpine already ships an entrypoint that runs /docker-entrypoint.d/*.sh
# before starting nginx, so our config injection runs automatically.
