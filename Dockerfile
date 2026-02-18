# --- STAGE 1: Build ---
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && npm run client:install

COPY . .
RUN npm run client:build
RUN npm prune --production

# --- STAGE 2: Final Production ---
FROM public.ecr.aws/docker/library/node:20-alpine

# 1. Install Nginx + Supervisor
RUN apk add --no-cache nginx supervisor

# 2. Setup Non-Root User
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# 3. Pre-create writeable paths
RUN mkdir -p \
    /app/logs \
    /tmp/client_body \
    /tmp/proxy_temp \
    /tmp/fastcgi_temp \
    /tmp/uwsgi_temp \
    /tmp/scgi_temp \
    /var/cache/nginx && \
    chown -R appuser:appgroup \
    /app \
    /var/lib/nginx \
    /var/log/nginx \
    /var/cache/nginx \
    /etc/nginx

# 4. Copy backend
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/server.mjs ./
COPY --from=builder --chown=appuser:appgroup /app/routes ./routes
COPY --from=builder --chown=appuser:appgroup /app/controllers ./controllers
COPY --from=builder --chown=appuser:appgroup /app/models ./models
COPY --from=builder --chown=appuser:appgroup /app/services ./services
COPY --from=builder --chown=appuser:appgroup /app/middlewares ./middlewares
COPY --from=builder --chown=appuser:appgroup /app/config ./config

# 5. Copy frontend build
COPY --from=builder --chown=appuser:appgroup /app/client/dist /usr/share/nginx/html

# 6. Configure nginx server block
COPY --chown=appuser:appgroup nginx.conf /etc/nginx/http.d/default.conf

# 7. Fix nginx.conf for non-root + redirect all paths to /tmp
RUN sed -i '/user nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's|worker_processes auto;|worker_processes auto;\npid /tmp/nginx.pid;|g' /etc/nginx/nginx.conf && \
    sed -i 's|error_log /var/log/nginx/error.log warn;|error_log /tmp/nginx.error.log warn;|g' /etc/nginx/nginx.conf && \
    sed -i 's|default_type application/octet-stream;|default_type application/octet-stream;\n\tclient_body_temp_path /tmp/client_body;\n\tproxy_temp_path /tmp/proxy_temp;\n\tfastcgi_temp_path /tmp/fastcgi_temp;\n\tuwsgi_temp_path /tmp/uwsgi_temp;\n\tscgi_temp_path /tmp/scgi_temp;|g' /etc/nginx/nginx.conf && \
    sed -i 's|access_log /var/log/nginx/access.log main;|access_log /tmp/nginx.access.log main;|g' /etc/nginx/nginx.conf

# 8. Supervisord config
COPY --chown=appuser:appgroup supervisord.conf /etc/supervisord.conf

# 9. Cleanup
RUN rm -rf /var/cache/apk/* /root/.npm

USER appuser
EXPOSE 8080

CMD ["supervisord", "-c", "/etc/supervisord.conf"]