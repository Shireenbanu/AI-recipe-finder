# --- STAGE 1: Build Frontend ---
FROM node:20-slim AS builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# --- STAGE 2: Production Image ---
FROM node:20-slim
WORKDIR /app

# Install Nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy built frontend to Nginx html directory
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy Nginx config
COPY nginx.conf /etc/nginx/sites-available/default

# Set up Backend
COPY package*.json ./
RUN npm install --production
COPY . .

# Expose Port 80 for Nginx
EXPOSE 80

# Start both Nginx and Express (Using a simple shell script or &&)
CMD service nginx start && node server.js