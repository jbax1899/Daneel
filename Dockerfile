# Stage 1: Build the frontend
FROM node:22.14.0 AS frontend-builder
WORKDIR /app

# Copy package files
COPY packages/frontend/web/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source
COPY packages/frontend/web/ ./

# Build the frontend
RUN npm run build


# Stage 2: Build the Discord bot
FROM node:22.14.0-slim AS bot-builder
WORKDIR /app

# Install build dependencies (needed for @discordjs/opus)
RUN apt-get update && apt-get install -y python3 make g++ && \
    npm config set python "/usr/bin/python3" --location=global

# Copy package files
COPY package*.json ./
COPY packages/discord-bot/package*.json packages/discord-bot/

# Install dependencies (includes @discordjs/opus build)
RUN npm install --include=dev

# Copy and build bot
COPY . .
RUN npx tsc -p packages/discord-bot/tsconfig.json

# Prune dev dependencies to reduce image size
RUN cd packages/discord-bot && npm install --production


# Stage 3: Final runtime image
FROM node:22.14.0-slim
WORKDIR /app

# Create necessary directories
RUN mkdir -p ./.next/static

# Copy built frontend
COPY --from=frontend-builder /app/.next/standalone ./ 
COPY --from=frontend-builder /app/.next/static ./.next/static

# Copy built bot
COPY --from=bot-builder /app/packages/discord-bot/dist ./packages/discord-bot/dist
COPY --from=bot-builder /app/packages/discord-bot/package*.json ./packages/discord-bot/
RUN cd packages/discord-bot && npm install --production

# Simple startup script
RUN echo '#!/bin/sh\n\
cd /app/packages/discord-bot && node dist/index.js & \n\
cd /app && node server.js\n\
' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]