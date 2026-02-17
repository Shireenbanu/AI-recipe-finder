# --- STAGE 1: Build & Dependencies ---
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && npm run client:install
COPY . .
RUN npm run client:build
RUN npm prune --production

# --- STAGE 2: Final Production Image ---
FROM public.ecr.aws/docker/library/node:20-alpine

# 1. Install Nginx and Curl
RUN apk add --no-cache nginx curl

# 2. Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# 3. Setup directories
RUN mkdir -p /app/logs /run/nginx /var/lib/nginx/tmp /var/log/nginx && \
    chown -R appuser:appgroup /app /run/nginx /var/lib/nginx /var/log/nginx /etc/nginx

# 4. Copy backend and built frontend
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/server.mjs ./
COPY --from=builder --chown=appuser:appgroup /app/routes ./routes
COPY --from=builder --chown=appuser:appgroup /app/controllers ./controllers
COPY --from=builder --chown=appuser:appgroup /app/scripts ./scripts
COPY --from=builder --chown=appuser:appgroup /app/services ./services
COPY --from=builder --chown=appuser:appgroup /app/models ./models
COPY --from=builder --chown=appuser:appgroup /app/config ./config
COPY --from=builder --chown=appuser:appgroup /app/middlewares ./middlewares

# Copy frontend to Nginx path (Note the builder path)
COPY --from=builder --chown=appuser:appgroup /app/client/dist /usr/share/nginx/html

# 5. CONFIGURE NGINX (Safe Overwrite)
# We use -f to ignore errors if the file doesn't exist
RUN rm -f /etc/nginx/http.d/default.conf
COPY nginx.conf /etc/nginx/http.d/default.conf

# 6. Fix Nginx for Non-Root Execution
RUN sed -i '/user nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's|/run/nginx.pid|/run/nginx/nginx.pid|g' /etc/nginx/nginx.conf

RUN apk del curl && \
    rm -rf /var/cache/apk/* /root/.npm /tmp/*    

USER appuser
EXPOSE 8080

# 7. Start both services
# Using 'daemon off' for nginx prevents it from exiting immediately
CMD ["sh", "-c", "nginx -g 'daemon off;' & node server.mjs"]