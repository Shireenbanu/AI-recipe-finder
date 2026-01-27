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

# Copy only the files needed to run the server
COPY package*.json ./
# Install only production dependencies (no devDependencies)
RUN npm install 

# Copy the server source code
COPY . .

# Copy the built React assets from the builder stage 
# This matches your server.js logic: path.join(__dirname, 'client/dist')
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000

# Add this before CMD
RUN echo "=== PACKAGE.JSON CONTENT ===" && cat package.json
RUN echo "=== FILES IN /app ===" && ls -la

CMD ["npm", "start"]