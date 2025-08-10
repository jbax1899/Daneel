# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="NodeJS"

# NodeJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y python3 pkg-config build-essential 

# Copy package files
COPY --link package.json package-lock.json ./
COPY --link packages/discord-bot/package.json ./packages/discord-bot/

# Install root dependencies including TypeScript
RUN npm install --include=dev

# Install discord-bot specific dependencies
RUN cd packages/discord-bot && \
    npm install --include=dev

# Copy application code
COPY --link . .

# Build the application using root's TypeScript
RUN npx tsc -p packages/discord-bot/tsconfig.json

# Remove development dependencies
RUN npm prune --production

# Start the server by default, this can be overwritten at runtime
WORKDIR /app/packages/discord-bot
CMD [ "node", "dist/index.js" ]