# Stage 1: Build the frontend
FROM node:22.14.0-slim as frontend-builder
WORKDIR /app

# Copy package files
COPY packages/frontend/package*.json packages/frontend/

# Install frontend dependencies
RUN cd packages/frontend && npm install

# Copy frontend source
COPY packages/frontend packages/frontend/

# Build frontend
RUN cd packages/frontend && npm run build

# Stage 2: Build the bot
FROM node:22.14.0-slim as bot-builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/discord-bot/package*.json packages/discord-bot/

# Install root dependencies
RUN npm install --include=dev

# Copy application code
COPY . .

# Build TypeScript
RUN npx tsc -p packages/discord-bot/tsconfig.json

# Install production dependencies
RUN cd packages/discord-bot && npm install --production

# Final stage
FROM node:22.14.0-slim
WORKDIR /app

# Install serve for the frontend
RUN npm install -g serve

# Copy built frontend
COPY --from=frontend-builder /app/packages/frontend/build ./frontend

# Copy built bot
COPY --from=bot-builder /app/packages/discord-bot/dist ./packages/discord-bot/dist

# Copy package.json and install production dependencies
COPY --from=bot-builder /app/packages/discord-bot/package*.json ./packages/discord-bot/
RUN cd packages/discord-bot && npm install --production

# Create a simple start script
RUN echo '#!/bin/sh\n\
    cd /app/packages/discord-bot && node dist/index.js & \n\
    serve -s /app/frontend -l 8080\n\
    ' > /app/start.sh && chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 8080

# Start the application
CMD ["/app/start.sh"]