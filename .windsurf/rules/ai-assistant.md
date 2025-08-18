---
trigger: always_on
---

# AI Assistant Project Structure

*This document outlines the project structure and organization for the AI Assistant project (Daneel).*

## Project Organization

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
        └── utils.ts         # Shared utility functions
```

### 3. Shared (`/packages/shared`)
```
shared/
└── src/
```

## Development Guidelines

### Code Organization
- **Commands**: One file per command in `commands/`
- **Events**: One file per event in `events/`
- **Components**: One component per file in `components/`
- **Utils**: Group related utility functions in appropriate files under `utils/`
- **Types**: Keep type definitions close to where they're used, with shared types in the shared package

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

### Documentation
- Keep these documentation files up to date (for example, when a new file is created):
  - /README.md (the pretty version used for the GitHub main page)
  - /cascadeReference.md (referenced frequently by Cascade)
  - /cascadeReferenceRolybot.md (referenced ocassionally by Cascade when adding features from legacy code)
- Do this by proposing changes to the relevant file(s) after your normal response