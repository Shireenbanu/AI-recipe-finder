# --- STAGE 1: Build the React Frontend ---
# checkov:skip=CKV_DOCKER_2:Healthcheck is managed at the AWS ALB Target Group level.
# checkov:skip=CKV_DOCKER_3:User permissions are enforced at the orchestrator (ECS) level.
# --- STAGE 1: Build & Dependencies ---
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

# 1. Install Nginx
RUN apk add --no-cache nginx curl

# 2. Create non-root user for production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 3. Copy only what is needed from builder
# Change ownership during copy to save space/time
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

# 4. Copy Frontend to Nginx path
COPY --from=builder --chown=appuser:appgroup /app/client/dist /usr/share/nginx/html

# 5. Fix Nginx Permissions (Crucial for Non-Root)
# Nginx needs to write to these folders, which root usually owns
RUN touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid /var/lib/nginx /var/log/nginx /etc/nginx

# 6. Switch to Non-Root User
USER appuser

EXPOSE 80

# JSON format CMD
CMD ["sh", "-c", "nginx && node server.mjs"]