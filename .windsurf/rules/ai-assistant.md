---
trigger: always_on
---

# AI Assistant Project Structure

*This document outlines the project structure and organization for the AI Assistant project (Daneel).*

## Development Guidelines

### Documentation
- IMPORTANT - Refer to these documentation files frequently, and keep them up to date by proposing edits:
  - /README.md (the pretty version used for the GitHub main page)
  - /cascadeReference.md (referenced frequently by Cascade)
  - /cascadeReferenceRolybot.md (referenced occasionally by Cascade when adding features from legacy code)

### Code Organization
- **Commands**: One file per command in `commands/`
- **Events**: One file per event in `events/`
- **Components**: One component per file in `components/`
- **Utils**: Group related utility functions in appropriate files under `utils/`
- **Types**: Keep type definitions close to where they're used, with shared types in the shared package

#### 1. Discord Bot (`/packages/discord-bot`)
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
│   │   ├── RateLimiter.ts  # Configurable rate limiting for users, channels, and guilds
│   │   │
│   │   ├── prompting/      # Prompt construction and management
│   │   │   ├── Planner.ts  # Determines response strategy (reply/DM/react)
│   │   │   └── PromptBuilder.ts # Builds conversation contexts for AI
│   │   │
│   │   └── response/       # Response handling
│   │       ├── ResponseHandler.ts # Handles formatting and sending responses
│   │       └── EmbedBuilder.ts    # Creates and validates Discord embeds
│   │
│   ├── MessageProcessor.ts # Core message processing pipeline
│   └── index.ts            # Bot entry point
```

#### 2. Frontend (`/packages/frontend`)
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
    │   ├── app-sidebar.tsx # Application sidebar
    │   └── assistant.tsx   # Assistant component
    │
    └── lib/                # Utility libraries
        └── utils.ts        # Shared utility functions
```

#### 3. Shared (`/packages/shared`)
```
shared/
└── src/
    ├── types/             # Shared TypeScript types
    └── constants/         # Shared constants and enums
```

### Naming Conventions
- **Files**: Use kebab-case for file names (e.g., `message-processor.ts`)
- **Components**: Use PascalCase (e.g., `MessageProcessor`)
- **Variables/Functions**: Use camelCase
- **Constants**: Use UPPER_SNAKE_CASE
- **Types/Interfaces**: Use PascalCase with a descriptive name (e.g., `MessageOptions`)

### TypeScript Best Practices
- Enable strict mode in `tsconfig.json`
- Use interfaces for object shapes that represent classes or complex types
- Use type aliases for unions, tuples, or other complex type definitions
- Avoid using `any` - prefer `unknown` with type guards
- Document complex types and functions with JSDoc comments
- Use discriminated unions for better type safety with similar but distinct types