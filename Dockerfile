# syntax = docker/dockerfile:1

# Stage 1: Build the frontend
FROM node:22.14.0-slim as frontend-builder
WORKDIR /app

# Create directory structure and copy package.json
RUN mkdir -p packages/frontend
COPY packages/frontend/package*.json packages/frontend/

# Install dependencies
RUN cd packages/frontend && npm install

# Copy frontend source
COPY packages/frontend/src packages/frontend/src/

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

# Copy built bot and its production node_modules
COPY --from=bot-builder /app/packages/discord-bot/dist ./packages/discord-bot/dist
COPY --from=bot-builder /app/packages/discord-bot/node_modules ./packages/discord-bot/node_modules

# Create a simple start script
RUN echo '#!/bin/sh\n\
    (cd /app/packages/discord-bot && node dist/index.js) & \n\
    cd /app/frontend && npx serve -s . -l 8080\n\
    wait' > /app/start.sh && \
    chmod +x /app/start.sh

CMD ["/app/start.sh"]