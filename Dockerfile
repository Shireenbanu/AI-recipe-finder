# --- STAGE 1: Build the React Frontend ---
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
WORKDIR /app

# 1. Copy root package files to handle scripts
COPY package*.json ./

# 2. Copy client package files specifically
COPY client/package*.json ./client/

# 3. Install ALL dependencies (Root + Client)
# This ensures "cd client && npm install" works
RUN npm install
RUN npm run client:install

# 4. Copy the rest of the source code
COPY . .

# 5. Build the React app (creates client/dist)
RUN npm run client:build


# --- STAGE 2: Final Production Image ---
FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app

# Install Nginx to serve the static frontend
RUN apk add --no-cache nginx curl

# Copy Backend node_modules and code from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.mjs ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/controllers ./controllers
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/services ./services
COPY --from=builder /app/models ./models
COPY --from=builder /app/config ./config
COPY --from=builder /app/middlewares ./middlewares

# COPY . .

# Copy the React Build to Nginx's default folder
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy your Nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Expose Port 80 for Nginx
EXPOSE 80

# Use JSON format for CMD (Fixes your Warning)
# This starts Nginx in the background and Node in the foreground
CMD ["sh", "-c", "nginx && node server.mjs"]