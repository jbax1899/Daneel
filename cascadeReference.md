*This document is automatically generated. Please update it as the project evolves.*

# Project Code Structure Reference

## Overview

This project, nicknamed "Daneel" (after the android in Isaac Asimov's "Foundation" series), is a comprehensive AI assistant system that currently includes a frontend web interface and a Discord bot.

This document provides a detailed overview of the project's code structure, including the packages, their dependencies, and the overall architecture.

Some rules to follow (for Cascade):
- All new shared code should go in `/packages/shared`
- TypeScript is used throughout the codebase
- Follow existing patterns for consistency
- Document complex logic and non-obvious decisions

## Table of Contents

1. [Technical Stack](#technical-stack)
2. [Repository Layout](#repository-layout)
3. [Packages](#packages)
4. [Architecture](#architecture)

## Technical Stack

### Core
- **Runtime**: Node.js 18+, TypeScript 5.0+
- **Package Manager**: npm 10+
- **Version Control**: Git/GitHub

### Frontend
- Next.js 15, React 19
- Styling: Tailwind CSS, shadcn/ui
- State: React Context + AI SDK
- Auth: Clerk
- Chat: @assistant-ui/react

### Discord Bot
- Discord.js 14
- Custom command/event system
- Winston logging
- TSX for development

### Dev Tools
- Bundler: Turbopack
- Linting: ESLint + Prettier
- CI/CD: GitHub Actions
- Deployment: Fly.io

## Repository Layout

```text
daneel/
├── .dockerignore             # Build context exclusions for Docker
├── .github/                  # GitHub Actions workflows and issue templates
├── .gitignore                # Git ignore patterns
├── .vscode/                  # VS Code workspace defaults
├── .windsurf/                # Cascade/Windsurf agent configuration
├── BuildRepoInitial.js       # Script to chunk repo files and upsert Pinecone embeddings
├── CreatePineconeIndex.js    # Helper to create the Pinecone index for repo search
├── Dockerfile                # Container image definition
├── fly.toml                  # Fly.io deployment settings
├── package.json              # Root workspaces configuration
├── tsconfig.json             # Base TypeScript options shared across packages
├── packages/                 # Workspace packages (bot, frontend, shared)
├── reference/                # Scratchpad and design references
└── README.md                 # Project overview and setup guide
```

## Packages

### 1. Discord Bot (`/packages/discord-bot`)
```text
discord-bot/
├── package.json              # Bot-specific dependencies and scripts
├── tsconfig.json             # Compiler options for the bot workspace
├── dist/                     # Transpiled JavaScript output (generated)
├── logs/                     # Winston log files written at runtime
└── src/
    ├── index.ts              # Bootstraps Discord client, loads commands/events, logs in
    ├── commands/             # Slash command implementations
    │   ├── BaseCommand.ts    # Shared typing helpers for slash command modules
    │   ├── call.ts           # `/call` voice prototype that joins/leaves voice channels
    │   ├── help.ts           # `/help` dynamic command catalog
    │   ├── image.ts          # `/image` OpenAI image generator with Cloudinary upload
    │   ├── news.ts           # `/news` web-search powered news summariser
    │   └── ping.ts           # `/ping` latency health check
    ├── events/               # Discord gateway event handlers
    │   ├── Event.ts          # Abstract base with registration + error handling
    │   └── MessageCreate.ts  # Message listener that triggers planning + responses
    ├── types/
    │   └── discord.d.ts      # Module augmentation adding a command cache to the client
    └── utils/                # Core services used across the bot
        ├── MessageProcessor.ts # Pipeline for rate limiting, context building, AI calls, replies
        ├── RateLimiter.ts       # Configurable rate limit helper + image cooldown tracker
        ├── commandHandler.ts    # Discovers, caches, and deploys slash commands
        ├── env.ts               # Loads .env and enforces required configuration
        ├── eventManager.ts      # Discovers and registers event classes with the client
        ├── logger.ts            # Winston logger setup (console + file transports)
        ├── openaiService.ts     # GPT-5 wrapper (text, embeddings, TTS, vision, pricing)
        ├── prompting/           # Conversation planning utilities
        │   ├── ContextBuilder.ts # Fetches + summarises history into OpenAI messages
        │   └── Planner.ts        # Planning LLM to decide actions, presence, and tool usage
        └── response/            # Response formatting & delivery helpers
            ├── EmbedBuilder.ts   # Guardrails around Discord embed construction
            └── ResponseHandler.ts # Message sending, chunking, typing, presence helpers
```

### 2. Frontend (`/packages/frontend`)
```text
frontend/
└── web/                      # Next.js assistant client (currently paused)
    ├── app/                  # App Router entrypoint + API routes
    ├── components/           # Assistant UI composition + shared UI building blocks
    └── lib/                  # Frontend utilities (Clerk, Assistant SDK wiring)
```

### 3. Shared (`/packages/shared`)
- Placeholder for future cross-package utilities and types
- Currently contains scaffolding ready for shared business logic

## Architecture

1. **Bootstrap & registration:** `src/index.ts` wires up the Discord client, loads slash commands via `CommandHandler`, registers event classes through `EventManager`, and logs in using validated environment variables from `env.ts`.
2. **Event-driven processing:** `MessageCreate` is the primary gateway event, delegating to `MessageProcessor` which enforces rate limits, gathers context with `ContextBuilder`, and requests a plan from the `Planner` LLM.
3. **AI execution:** `OpenAIService` handles GPT-5 interactions, reasoning tool calls, embeddings, TTS generation, and image descriptions. Command modules reuse the shared instance exported from `index.ts` for specialised behaviours like `/news` and `/image`.
4. **Response delivery:** `ResponseHandler` and the `response/` helpers manage typing indicators, chunked replies, embeds, file uploads, and presence updates so command logic stays concise.
