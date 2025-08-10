# Stage 1: Build the frontend
FROM node:22.14.0 AS frontend-builder
WORKDIR /app

# Copy package files
COPY packages/frontend/web/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source
COPY packages/frontend/web/ ./

# Build the frontend
RUN npm run build

# Stage 2: Build the bot (keep your existing bot build stage)
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

# Copy built frontend
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

# Copy built bot
COPY --from=bot-builder /app/packages/discord-bot/dist ./packages/discord-bot/dist
COPY --from=bot-builder /app/packages/discord-bot/package*.json ./packages/discord-bot/
RUN cd packages/discord-bot && npm install --production

# Create a simple start script
RUN echo '#!/bin/sh\n\
    cd /app/packages/discord-bot && node dist/index.js & \n\
    cd /app && node server.js\n\
    ' > /app/start.sh && chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["/app/start.sh"]