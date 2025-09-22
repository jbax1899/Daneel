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

1. [Project Status](#project-status)
2. [Technical Stack](#technical-stack)
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

## Packages

### 1. Discord Bot (`/packages/discord-bot`)
```
discord-bot/
├── src/
│   ├── commands/           # Bot command handlers
│   │   ├── BaseCommand.ts  # Base command class
│   │   ├── help.ts         # Help command
│   │   ├── image.ts        # Image generation command
│   │   ├── news.ts          # News fetching command
│   │   └── ping.ts         # Ping command
│   │
│   ├── events/             # Discord event handlers
│   │   ├── Event.ts        # Base event class
│   │   └── MessageCreate.ts # Handles message creation events
│   │
│   ├── types/              # TypeScript type definitions
│   │   └── discord.d.ts    # Extended Discord.js type definitions
│   │
│   ├── utils/              # Utility functions
│   │   ├── commandHandler.ts # Command loading and registration
│   │   ├── env.ts          # Environment variable validation
│   │   ├── eventManager.ts # Event loading and registration
│   │   ├── logger.ts       # Logging utilities
│   │   ├── MessageProcessor.ts # Core message processing pipeline
│   │   ├── openaiService.ts # OpenAI integration for AI responses
│   │   ├── RateLimiter.ts  # Configurable rate limiting for users, channels, and guilds
│   │   │
│   │   ├── prompting/      # Prompt construction and management
│   │   │   ├── ContextBuilder.ts # Builds conversation contexts for AI
│   │   │   └── Planner.ts    # AI planning and task management
│   │   │
│   │   └── response/       # Response handling
│   │       ├── EmbedBuilder.ts    # Discord embed building utilities
│   │       └── ResponseHandler.ts # Handles formatting and sending responses
│   │
│   └── index.ts            # Bot entry point
```

### 2. Frontend (`/packages/frontend`)
```
frontend/
└── web/                    # Next.js application
    ├── app/                # App router
    │   ├── api/            # API routes
    │   ├── assistant.tsx   # Assistant page
    │   ├── globals.css     # Global styles
    │   ├── layout.tsx      # Root layout
    │   └── page.tsx        # Home page
    │
    ├── components/         # Reusable UI components
    │   ├── assistant-ui/   # Assistant UI components
    │   ├── ui/             # Base UI components (shadcn/ui)
    │   ├── app-sidebar.tsx  # Application sidebar
    │   └── assistant.tsx    # Assistant component
    │
    └── lib/                 # Utility libraries
```

### 3. Shared (`/packages/shared`)
- Shared types and utilities between frontend and backend
- Common validation schemas
- Shared business logic