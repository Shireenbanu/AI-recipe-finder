# --- STAGE 1: Build Frontend ---
# Replace node:20-slim with the AWS ECR version
FROM public.ecr.aws/docker/library/node:20-slim AS builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# --- STAGE 2: Production Image ---
FROM public.ecr.aws/docker/library/node:20-slim
WORKDIR /app

# Install Nginx (The debian-slim image uses apt)
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy built frontend to Nginx html directory
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy Nginx config (Ensure nginx.conf is in your root directory)
COPY nginx.conf /etc/nginx/sites-available/default

# Set up Backend
COPY package*.json ./
RUN npm install --production
COPY . .

# Expose Port 80 for Nginx
EXPOSE 80

# Start both Nginx and Express
# We use -g "daemon off;" to keep Nginx running in the foreground 
# while node runs in the background or vice versa.
CMD service nginx start && node server.js