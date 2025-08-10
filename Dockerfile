# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="NodeJS"

# NodeJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential 

# Copy package files
COPY --link package.json package-lock.json ./
COPY --link packages/discord-bot/package.json packages/discord-bot/package.json

# Install all dependencies (including devDependencies)
RUN npm install --include=dev

# Copy TypeScript config
COPY --link tsconfig.json ./
COPY --link packages/discord-bot/tsconfig.json packages/discord-bot/

# Copy application code
COPY --link . .

# Build application
RUN npm run build --workspace=@ai-assistant/discord-bot

# Production stage
FROM base

# Copy built application and production dependencies
COPY --from=build /app/packages/discord-bot /app
COPY --from=build /app/node_modules /app/node_modules

# Start the server by default, this can be overwritten at runtime
WORKDIR /app
CMD [ "node", "dist/index.js" ]