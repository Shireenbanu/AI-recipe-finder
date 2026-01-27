# 1. Build Stage (React)
FROM public.ecr.aws/docker/library/node:18-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies for both backend and frontend
RUN npm install
RUN npm run client:install

# Copy source and build React
COPY . .
RUN npm run client:build

# 2. Production Stage (Node.js)
FROM public.ecr.aws/docker/library/node:18-alpine
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package.json FIRST (preserves "type": "module")
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy server source code
COPY server.js ./
COPY routes ./routes
COPY middleware ./middleware
COPY controllers ./controllers
COPY models ./models
COPY config ./config
COPY utils ./utils
# Add any other backend directories you have

# Copy the built React assets from the builder stage
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "server.js"]