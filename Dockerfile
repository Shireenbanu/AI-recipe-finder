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

# 5. CONFIGURE NGINX (The missing piece)
# First, remove the default Alpine config
RUN rm -f /etc/nginx/http.d/default.conf

# Copy your local custom config into the container
# This file contains your 8080 port and Gemini timeouts
COPY nginx.conf /etc/nginx/http.d/default.conf

# 6. Fix Nginx Permissions for Non-Root Execution
RUN mkdir -p /run/nginx /var/lib/nginx/tmp /var/log/nginx && \
    chown -R appuser:appgroup /run/nginx /var/lib/nginx /var/log/nginx /etc/nginx && \
    # Remove 'user' directive and fix PID path
    sed -i '/user nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's|/run/nginx.pid|/run/nginx/nginx.pid|g' /etc/nginx/nginx.conf

# 7. Switch to the non-root user
USER appuser
FROM nginx:alpine

# 1. Remove the default configuration that's causing the 404
RUN rm /etc/nginx/http.d/default.conf

# 2. Copy your custom config into that same directory
# This ensures Nginx uses YOUR settings for port 8080
COPY nginx.conf /etc/nginx/http.d/default.conf

# 3. Copy your React/Vite build files
COPY --from=builder /app/dist /usr/share/nginx/html
# 8. Expose Port 8080 
EXPOSE 8080

# 9. Start Nginx and the Node.js server
# Using '&' ensures both start; 'nginx' is launched as a background process here
CMD ["sh", "-c", "nginx && node server.mjs"]