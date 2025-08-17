*This document is automatically generated. Please update it as the project evolves.*

# Project Code Structure Reference

## Overview

This project, nicknamed "Daneel" (after the android in Isaac Asimov's "Foundation" series), is a comprehensive AI assistant system that currently includes a frontend web interface and a Discord bot.

This document provides a detailed overview of the project's code structure, including the packages, their dependencies, and the overall architecture.

A companion document, `cascadeReferenceRolybot.md`, provides a detailed code review of the legacy RolyBot project, which is the basis for the new Discord bot implementation. Before implementing new features, please refer to this document first to avoid re-inventing the wheel (though, the old way is not always the best way).

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
5. [Future Improvements](#future-improvements)

## Project Status

### Current Phase: Core Functionality (Q3 2025)
- [x] Set up monorepo structure
- [x] Implement basic Discord bot with slash commands
- [x] Create Next.js frontend with basic chat interface
- [x] Set up CI/CD pipeline with GitHub Actions
- [x] Create a basic Discord bot with slash commands
- [x] Create a basic frontend with chat interface
- [x] Implement MessageProcessor for handling message flow
- [x] Add PromptBuilder for AI context management
- [x] Implement ResponseHandler for centralized response management
- [ ] Implement rate limiting system
- [ ] Add basic moderation commands
- [ ] Implement user feedback system

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
│   │   └── ping.ts         # Ping command
│   │
│   ├── events/             # Discord event handlers
│   │   ├── Event.ts        # Base event class
│   │   ├── MentionBotEvent.ts # Handles @mentions and replies
│   │   └── ready.ts        # Bot ready event handler
│   │
│   ├── types/              # TypeScript type definitions
│   │   └── discord.d.ts    # Extended Discord.js type definitions
│   │
│   ├── utils/              # Utility functions
│   │   ├── commandHandler.ts # Command loading and registration
│   │   ├── env.ts          # Environment variable validation
│   │   ├── logger.ts       # Logging utilities
│   │   │
│   │   ├── prompting/      # Prompt construction and management
│   │   │   └── PromptBuilder.ts # Builds conversation contexts for AI
│   │   │
│   │   └── response/       # Response handling
│   │       └── ResponseHandler.ts # Handles formatting and sending responses
│   │
│   ├── MessageProcessor.ts # Core message processing pipeline
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

## Architecture

### Core Components

#### 1. MessageProcessor
- Handles incoming messages and orchestrates the response flow
- Integrates with PromptBuilder and ResponseHandler
- Manages conversation state

#### 2. PromptBuilder
- Constructs prompts for the AI
- Manages conversation history
- Handles context injection

#### 3. ResponseHandler
- Manages all bot responses
- Handles different response types (text, embeds, DMs, reactions)
- Provides consistent error handling

### Message Flow
1. `MentionBotEvent` receives and validates the message
2. `MessageProcessor` handles the message:
   - Builds context using `PromptBuilder`
   - Generates AI response
   - Manages response through `ResponseHandler`
3. `ResponseHandler` sends the response to Discord

## Future Improvements

### Core Features
- [ ] Rate limiting system
- [ ] Moderation commands
- [ ] User feedback system
- [ ] Database integration
- [ ] Caching layer

### Developer Experience
- [ ] Enhanced testing framework
- [ ] Better error tracking
- [ ] Performance monitoring
- [ ] Documentation improvements

### Infrastructure
- [ ] Database migrations
- [ ] Backup system
- [ ] Advanced logging
- [ ] Metrics collection

### Security
- [ ] Rate limiting
- [ ] Input validation
- [ ] Audit logging
- [ ] Security headers

### Documentation
- [ ] API documentation
- [ ] Architecture decision records (ADRs)
- [ ] User guides
- [ ] Development setup guide

### Performance
- [ ] Query optimization
- [ ] Caching strategy
- [ ] Load testing
- [ ] Bundle size optimization
