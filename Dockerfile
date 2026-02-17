# --- STAGE 1: Build & Dependencies ---
# checkov:skip=CKV_DOCKER_2:Healthcheck is managed at the AWS ALB Target Group level.
# checkov:skip=CKV_DOCKER_3:User permissions are enforced at the orchestrator (ECS) level.
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && npm run client:install

# Copy source and build
COPY . .
RUN npm run client:build

# Prune devDependencies to keep the image small and secure
RUN npm prune --production


# --- STAGE 2: Final Production Image ---
FROM public.ecr.aws/docker/library/node:20-alpine

# 1. Install Nginx and Curl for health checks
RUN apk add --no-cache nginx curl

# 2. Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 3. Pre-create the logs directory for Winston/Node
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app/logs

# 4. Copy backend and built frontend from builder with correct ownership
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

# Copy the React Build to Nginx's default folder
COPY --from=builder --chown=appuser:appgroup /app/client/dist /usr/share/nginx/html

# 5. Fix Nginx Permissions for Non-Root Execution
# We create necessary dirs and ensure appuser owns them
RUN mkdir -p /run/nginx /var/lib/nginx/tmp /var/log/nginx && \
    chown -R appuser:appgroup /run/nginx /var/lib/nginx /var/log/nginx /etc/nginx && \
    # Remove the 'user' directive from the main nginx.conf (can't switch users as non-root)
    sed -i '/user nginx;/d' /etc/nginx/nginx.conf && \
    # Ensure the PID file path is writable
    sed -i 's|/run/nginx.pid|/run/nginx/nginx.pid|g' /etc/nginx/nginx.conf

# 6. Switch to the non-root user
USER appuser

# 7. Expose Port 8080 (Non-root users cannot bind to port 80)
EXPOSE 8080

# 8. Start Nginx and the Node.js server
# Nginx runs in background, Node runs in foreground
CMD ["sh", "-c", "nginx && node server.mjs"]