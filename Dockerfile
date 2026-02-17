# --- STAGE 1: Build ---
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app
# Install dependencies first (better caching)
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && npm run client:install
# Copy ALL source code and build the React frontend
COPY . .
RUN npm run client:build
# Remove devDependencies to keep the final image light
RUN npm prune --production

# --- STAGE 2: Final Production ---
FROM public.ecr.aws/docker/library/node:20-alpine

# 1. Install Nginx
RUN apk add --no-cache nginx

# 2. Setup Non-Root User
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# 3. Pre-create all necessary writeable paths
RUN mkdir -p /app/logs /run/nginx /var/lib/nginx/tmp /var/log/nginx && \
    chown -R appuser:appgroup /app /run/nginx /var/lib/nginx /var/log/nginx /etc/nginx

# 4. COPY ALL BACKEND FOLDERS (Crucial Step)
# This ensures your routes, controllers, and models actually exist in the image
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/server.mjs ./
COPY --from=builder --chown=appuser:appgroup /app/routes ./routes
COPY --from=builder --chown=appuser:appgroup /app/controllers ./controllers
COPY --from=builder --chown=appuser:appgroup /app/models ./models
COPY --from=builder --chown=appuser:appgroup /app/services ./services
COPY --from=builder --chown=appuser:appgroup /app/middlewares ./middlewares
COPY --from=builder --chown=appuser:appgroup /app/config ./config

# 5. COPY THE FRONTEND BUILD
COPY --from=builder --chown=appuser:appgroup /app/client/dist /usr/share/nginx/html

# 6. CONFIGURE NGINX (Overwriting default to use 8080)
COPY nginx.conf /etc/nginx/http.d/default.conf

# 7. RE-ALIGN NGINX FOR NON-ROOT
# Removes the 'user nginx' directive and fixes the PID path
RUN sed -i '/user nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's|/run/nginx.pid|/run/nginx/nginx.pid|g' /etc/nginx/nginx.conf

# 8. Final Hardening
RUN rm -rf /var/cache/apk/* /root/.npm

USER appuser
EXPOSE 8080

# Starts Nginx on 8080 and Node on 3000 (Ensure server.mjs uses port 3000)
CMD ["sh", "-c", "nginx -g 'daemon off;' & node server.mjs"]