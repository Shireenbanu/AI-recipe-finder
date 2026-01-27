# 2. Production Stage (Node.js)
FROM public.ecr.aws/docker/library/node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json ./
COPY package-lock.json ./

# DEBUG: Print package.json BEFORE npm install
RUN echo "=== PACKAGE.JSON BEFORE NPM INSTALL ===" && cat package.json | grep -A 2 '"type"'

# Install dependencies
RUN npm install --omit=dev

# DEBUG: Print package.json AFTER npm install
RUN echo "=== PACKAGE.JSON AFTER NPM INSTALL ===" && cat package.json | grep -A 2 '"type"'

# Copy package.json again to ensure it's correct
COPY package.json ./

# DEBUG: Print package.json AFTER SECOND COPY
RUN echo "=== PACKAGE.JSON AFTER SECOND COPY ===" && cat package.json | grep -A 2 '"type"'

# Copy server source files
COPY server.js ./
COPY routes ./routes
COPY middleware ./middleware
COPY controllers ./controllers
COPY models ./models
COPY config ./config
COPY utils ./utils
COPY services ./services

# Copy the built React assets
COPY --from=builder /app/client/dist ./client/dist

# DEBUG: Print final package.json before CMD
RUN echo "=== FINAL PACKAGE.JSON ===" && cat package.json

# DEBUG: List all files
RUN echo "=== ALL FILES IN /app ===" && ls -la

EXPOSE 3000

CMD ["npm", "start"]