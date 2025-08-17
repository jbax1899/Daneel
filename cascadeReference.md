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

1. [Overview](#overview)
2. [Project Roadmap](#project-roadmap)
3. [Technical Stack](#technical-stack)
4. [Deployment](#deployment)
5. [Packages](#packages)
   - [Discord Bot](#1-discord-bot-packagesdiscord-bot)
   - [Frontend](#2-frontend-packagesfrontend)
   - [Shared](#3-shared-packagesshared)
   - [Backend](#4-backend-packagesbackend)
6. [Reference Materials](#reference-materials-reference)
7. [Legacy System Integration](#legacy-system-integration)
8. [Code Quality Analysis](#code-quality-analysis)
9. [Future-Proofing](#future-proofing)

## Project Roadmap

### Phase 1: Core Functionality (Q3 2025)
- [x] Set up monorepo structure
- [x] Implement basic Discord bot with slash commands
- [x] Create Next.js frontend with basic chat interface
- [x] Set up CI/CD pipeline with GitHub Actions
- [x] Create a basic Discord bot with slash commands
- [x] Create a basic frontend with chat interface
- [x] Implement MessageProcessor for handling message flow
- [x] Add PromptBuilder for AI context management
- [x] Set up basic response handling
- [ ] Add comprehensive error handling and logging
- [ ] Implement command system enhancements
- [ ] Add user preferences and state management

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
- Animation: Framer Motion

### Backend
- Next.js API Routes + Vercel AI SDK
- Database: (Planned)
- Caching: (Planned)
- Search: (Planned)

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

### Key Dependencies
```json
{
  "next": "15.3.2",
  "react": "^19.1.0",
  "discord.js": "^14.21.0",
  "openai": "^5.12.2",
  "ai": "^5.0.8",
  "@assistant-ui/react": "^0.10.9",
  "@clerk/nextjs": "^6.30.0",
  "tailwindcss": "^4.1.11",
  "typescript": "^5.0.0"
}
```

## Deployment

### Fly.io Setup
1. **Prerequisites**
   - Fly.io account
   - Fly.io CLI installed
   - GitHub repository connected

2. **Automatic Deployments**
   - Pushes to `main` branch trigger automatic deployments
   - GitHub Actions handles the build and deployment process
   - Zero-downtime deployments with health checks

3. **Configuration**
   - Managed through `fly.toml`
   - Environment variables set in Fly.io dashboard
   - Automatic HTTPS with Let's Encrypt

4. **Scaling**
   - Horizontal scaling available
   - Automatic scaling based on load (configurable)
   - Multiple regions supported

5. **Monitoring**
   - Built-in metrics and logging
   - Health checks and automatic recovery
   - Error tracking integration available

6. **Rollback**
   - Automatic rollback on deployment failure
   - Manual rollback to previous versions available
   - Deployment history and audit logs

7. **Environment Variables**
   ```
   DATABASE_URL=postgres://...
   DISCORD_TOKEN=...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   NODE_ENV=production
   ```

8. **Custom Domains**
   - Support for custom domains
   - Automatic SSL certificate management
   - HTTP/2 and HTTP/3 supported

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
    ├── components/          # Reusable UI components
    │   ├── assistant-ui/   # Assistant UI components
    │   ├── ui/             # Base UI components (shadcn/ui)
    │   ├── app-sidebar.tsx  # Application sidebar
    │   └── assistant.tsx    # Assistant component
    │
    ├── lib/                 # Utility libraries
    │   └── (to be documented)
    │
    ├── public/              # Static assets
```

### 3. Shared (`/packages/shared`)
- Currently empty
- Intended for shared types, utilities, and business logic between packages

### 4. Backend (`/packages/backend`)
- Currently empty
- Will contain API server and business logic

## Reference Materials (`/reference`)

### 1. RolyBot (`/reference/RolyBot`)
- Complete source code of the legacy "RolyBot" implementation (the previous version of the Discord bot that's being rebuilt)
- Useful for reference when implementing similar functionality in the new version
- See `cascadeReferenceRolybot.md` for a detailed code review of the legacy RolyBot implementation
```
RolyBot/
├── commands/               # Bot command handlers
│   ├── chess.js           # Chess game commands
│   ├── debug.js           # Debugging utilities
│   ├── help.js            # Help command
│   ├── memoryCommand.js   # Memory-related commands
│   └── status.js          # Bot status command
│
├── config/                 # Configuration files
│   └── responseConfig.js   # Response configuration
│
├── utils/                  # Utility functions
│   ├── chess/              # Chess game logic
│   │   ├── aiMoveService.js    # AI move generation
│   │   ├── challengeManager.js # Game challenges
│   │   ├── gameManager.js      # Game session management
│   │   ├── gameStateManager.js # Game state handling
│   │   ├── moveParser.js       # Chess move parsing
│   │   ├── threadManager.js    # Game thread management
│   │   └── threadUtils.js      # Thread utilities
│   │
│   ├── commandLoader.js    # Command loading and registration
│   ├── context.json        # Context data
│   ├── contextGenerators.js# Context generation utilities
│   ├── contextUtils.js     # Context helper functions
│   ├── conversationMemory.js # Conversation memory management
│   ├── logger.js           # Logging configuration
│   ├── loggingUtils.js     # Logging utilities
│   ├── memoryManager.js    # Memory management
│   ├── memoryRetrieval.js  # Memory retrieval logic
│   ├── messageClassifier.js# Message classification
│   ├── messageUtils.js     # Message handling utilities
│   ├── openaiHelper.js     # OpenAI API integration
│   ├── responseUtils.js    # Response generation utilities
│   ├── rolybotResponse.js  # Response formatting
│   └── vectorUtils.js      # Vector operations
│
├── .env                    # Environment variables
├── bot.js                  # Main bot file
├── package.json            # Dependencies and scripts
└── README.md               # Project documentation
```

### 2. Assistant UI (`/reference/assistant-ui-main`)
- Reference implementation of the Assistant UI component library
- Contains pre-built UI components for chat interfaces
- Includes examples and documentation for component usage

### 3. Discord.js Documentation (`/reference/discord.js-main`)
- Local copy of the Discord.js library documentation
- Useful for offline reference and implementation details
- Contains type definitions and API references

## Legacy System Integration

### Reusable Components from RolyBot

#### 1. Memory Management System
- **Key Features**:
  - Message history and context management
  - Multi-dimensional relevance scoring (cosine, Jaccard, Levenshtein)
  - Context-aware memory retrieval

- **Integration Strategy**:
  - Port the memory retrieval algorithms
  - Adapt for TypeScript and modern async/await patterns
  - Add persistent storage using a database

- **Required Changes**:
  - Replace in-memory storage with a database
  - Update to use modern NLP libraries
  - Add proper error handling and logging

#### 2. Chess Game System
- **Key Features**:
  - Complete chess game implementation
  - AI integration with Stockfish
  - Thread-based game management

- **Integration Strategy**:
  - Extract core chess logic into a separate package
  - Update to use current Discord.js features
  - Implement proper state persistence

- **Required Changes**:
  - Update dependencies (chess.js, node-uci)
  - Add TypeScript types
  - Improve error handling

#### 3. Thread Management
- **Key Features**:
  - Dedicated threads for games
  - Permission management
  - Voice channel integration

- **Integration Strategy**:
  - Extract thread management logic
  - Create reusable thread utilities
  - Add configuration options

- **Required Changes**:
  - Update to use Discord.js v14+ features
  - Add proper error boundaries
  - Implement cleanup procedures

### Feature Comparison

| Feature | RolyBot Implementation | New Implementation | Notes |
|---------|------------------------|-------------------|-------|
| Memory | In-memory with sync | Needs persistence | Add database backend |
| Chess | Complete implementation | Not implemented | Consider as plugin |
| Threads | Basic management | Not implemented | Extract reusable utilities |
| Commands | Basic structure | Modern implementation | Already improved |
| Error Handling | Basic try-catch | Needs improvement | Add structured logging |

### Migration Recommendations

1. **High Priority**
   - Port memory management with persistence
   - Extract reusable thread utilities
   - Implement proper error handling

2. **Medium Priority**
   - Port chess game as a plugin
   - Update voice channel integration
   - Add comprehensive logging

3. **Low Priority**
   - Advanced NLP features
   - Game statistics and analytics
   - Admin dashboard

### Technical Debt Considerations
- **Dependencies**:
  - Update all dependencies to current versions
  - Replace deprecated packages
  - Add proper type definitions

- **Code Quality**:
  - Add comprehensive tests
  - Implement CI/CD pipelines
  - Add documentation

- **Performance**:
  - Optimize memory usage
  - Add caching where appropriate
  - Implement rate limiting

### Integration Plan

1. **Phase 1: Foundation**
   - Set up database integration
   - Implement core memory system
   - Add basic thread management

2. **Phase 2: Features**
   - Port chess game system
   - Add voice channel support
   - Implement user preferences

3. **Phase 3: Polish**
   - Add comprehensive error handling
   - Implement analytics
   - Optimize performance

## Code Quality Analysis

### Discord Bot Architecture Review

#### Command System
- **Base Command Structure**
  - Commands implement a simple `Command` interface with `data` and `execute` properties
  - Uses Discord.js's `SlashCommandBuilder` for type-safe command definitions
  - Each command is self-contained in its own file

- **Command Handler**
  - Implements dynamic command discovery from the commands directory
  - Supports both development (.ts) and production (.js) environments
  - Uses a `Collection` to store and manage commands
  - Includes basic error handling and logging

- **Strengths**
  - Clean separation of concerns between command definition and execution
  - TypeScript support provides good type safety
  - Dynamic loading makes it easy to add new commands

- **Recommendations**
  - Consider adding middleware support for cross-cutting concerns (e.g., permissions, cooldowns)
  - Implement a more robust error handling strategy for command execution
  - Add input validation for command options
  - Consider adding a help command generator based on command metadata

#### Event System
- **Base Event Structure**
  - Uses an abstract `Event` class with a consistent interface
  - Supports both once and regular event listeners
  - Includes basic error handling at the event level

- **Event Registration**
  - Events are registered with the Discord.js client
  - Automatic error catching and logging for event handlers
  - Supports both synchronous and asynchronous event handlers

- **Strengths**
  - Consistent interface for all events
  - Built-in error handling prevents uncaught exceptions
  - Clean separation between event registration and handling

- **Recommendations**
  - Consider adding event middleware for cross-cutting concerns
  - Implement more detailed logging for event handling
  - Add support for event priorities or ordering
  - Consider adding event validation and transformation

#### General Architecture Recommendations
1. **Dependency Injection**
   - Consider implementing a DI container for better testability
   - Would make it easier to mock dependencies in tests

2. **Configuration Management**
   - Centralize configuration management
   - Consider using a validation library for environment variables

3. **Logging**
   - Implement structured logging
   - Add correlation IDs for tracking requests across services

4. **Testing**
   - Add unit tests for commands and events
   - Consider integration tests for critical flows
   - Add end-to-end tests for key user journeys

5. **Documentation**
   - Add JSDoc/TSDoc comments for public APIs
   - Document architectural decisions (ADRs)
   - Add examples for common use cases

6. **Error Handling**
   - Implement a centralized error handling strategy
   - Add more specific error types
   - Improve error messages for end users

### Discord Bot Component Review

### Command Structure

#### Current Implementation
- **Command Definition**
  - Commands are defined as simple objects implementing the `Command` interface
  - Each command has a `data` property (SlashCommandBuilder) and an `execute` method
  - Example commands: `help.ts`, `ping.ts`

- **Command Registration**
  - Commands are dynamically discovered from the `commands` directory
  - File-based naming convention: command name matches the filename
  - Automatic loading of both `.ts` (development) and `.js` (production) files

- **Error Handling**
  - Basic try-catch in command handlers
  - Ephemeral error messages for user-facing errors
  - Console logging for debugging

#### Strengths
- Simple and straightforward implementation
- Easy to add new commands
- Good separation between command definition and execution
- TypeScript support provides type safety

#### Areas for Improvement

1. **Middleware Support**
   - Currently no built-in middleware system
   - Recommended: Add middleware support for cross-cutting concerns:
     ```typescript
     interface CommandMiddleware {
       (interaction: ChatInputCommandInteraction, next: () => Promise<void>): Promise<void>;
     }
     ```

2. **State Management**
   - No built-in state management between command executions
   - Recommended: Add a context object that persists across command executions
   - Could include user preferences, conversation history, etc.

3. **Command Organization**
   - Flat structure in the commands directory
   - Recommended: Group related commands in subdirectories
     ```
     commands/
       ├── admin/
       │   ├── ban.ts
       │   └── kick.ts
       ├── games/
       │   ├── chess.ts
       │   └── trivia.ts
       └── utility/
           ├── help.ts
           └── ping.ts
     ```

4. **Input Validation**
   - Basic validation through SlashCommandBuilder
   - Recommended: Add runtime validation with a validation library
   - Consider using class-validator or similar

5. **Command Cooldowns**
   - No built-in rate limiting
   - Recommended: Add cooldown support per command

6. **Permission System**
   - Basic Discord permissions only
   - Recommended: Add a role-based permission system
   - Could integrate with Discord's role system

7. **Command Categories**
   - No built-in categorization
   - Recommended: Add metadata for command categories
   - Could be used for better help organization

8. **Testing**
   - No visible test files
   - Recommended: Add unit tests for commands
   - Consider using a testing framework like Jest

#### Example Improved Command Structure
```typescript
// Example of an enhanced command with metadata and middleware support
const command: Command = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command')
    .addStringOption(option => 
      option.setName('input')
        .setDescription('The input to process')
        .setRequired(true)),
        
  // Command metadata
  metadata: {
    category: 'utility',
    cooldown: 5, // seconds
    permissions: ['SEND_MESSAGES'],
  },
  
  // Middleware
  middleware: [
    requireAuth,
    rateLimiter,
    loggerMiddleware
  ],
  
  // Command handler
  async execute(interaction, context) {
    const input = interaction.options.getString('input');
    // Command logic here
  }
};
```

#### Recommendations
1. **Immediate Actions**
   - Add JSDoc documentation for all events
   - Implement basic event validation
   - Add middleware support

2. **Short-term Improvements**
   - Add dependency injection for event handlers
   - Implement event lifecycle management
   - Add basic test coverage

3. **Long-term Considerations**
   - Add event metrics and monitoring
   - Implement event replay capabilities
   - Add support for event filtering and routing

## Future-Proofing

### Extension Points

#### 1. Plugin Architecture
- **Current State**:
  - Limited extension capabilities
  - No formal plugin system

- **Recommendations**:
  - Implement a plugin registry
  - Define clear extension points:
    ```typescript
    interface Plugin {
      name: string;
      version: string;
      commands?: Command[];
      events?: Event[];
      initialize?(): Promise<void>;
      cleanup?(): Promise<void>;
    }
    ```
  - Add lifecycle hooks for plugins
  - Support dynamic loading/unloading

#### 2. Configuration System
- **Current State**:
  - Basic environment variables
  - Limited runtime configuration

- **Recommendations**:
  - Hierarchical configuration
  - Support for multiple formats (JSON, YAML, env)
  - Schema validation
  - Hot reload capability

#### 3. API Design
- **Current State**:
  - Basic REST-like endpoints
  - Limited versioning support

- **Recommendations**:
  - Versioned API endpoints
  - OpenAPI/Swagger documentation
  - Backward compatibility guarantees
  - Deprecation policy

### Testing Strategy

#### 1. Test Pyramid Implementation
- **Unit Tests (60%)**:
  - Core business logic
  - Utility functions
  - Individual components in isolation

- **Integration Tests (30%)**:
  - Component interactions
  - API endpoints
  - Database operations

- **E2E Tests (10%)**:
  - User flows
  - Critical paths
  - Cross-browser/device testing

#### 2. Test Automation
- **CI/CD Pipeline**:
  - Automated test execution
  - Code coverage reporting
  - Performance benchmarking
  - Security scanning

- **Quality Gates**:
  - Minimum test coverage (e.g., 80%)
  - Performance budgets
  - Security thresholds

### Performance Considerations

#### 1. Frontend Optimization
- Code splitting
- Lazy loading
- Image optimization
- Bundle size monitoring

#### 2. Backend Optimization
- Caching strategies
- Database indexing
- Query optimization
- Connection pooling

### Security Measures

#### 1. Authentication & Authorization
- JWT validation
- Role-based access control
- Rate limiting
- CSRF protection

#### 2. Data Protection
- Encryption at rest
- Encryption in transit
- Secure secret management
- Regular security audits

### Monitoring & Observability

#### 1. Logging
- Structured logging
- Log levels
- Log rotation
- Centralized log management

#### 2. Metrics
- Application metrics
- Business metrics
- Real-time dashboards
- Alerting

#### 3. Tracing
- Distributed tracing
- Performance analysis
- Error tracking

### Documentation Strategy

#### 1. Code Documentation
- JSDoc/TSDoc comments
- API documentation
- Architecture decision records (ADRs)

#### 2. User Documentation
- Getting started guides
- Feature documentation
- Troubleshooting
- FAQ

### Deprecation Policy

#### 1. Versioning Strategy
- Semantic Versioning (SemVer)
- Clear upgrade paths
- Deprecation notices
- Migration guides

#### 2. Backward Compatibility
- API versioning
- Feature flags
- Graceful degradation
- Deprecation timeline

### Continuous Improvement

#### 1. Tech Debt Management
- Regular tech debt reviews
- Prioritization framework
- Dedicated improvement sprints

#### 2. Dependency Management
- Regular updates
- Security vulnerability scanning
- License compliance
- Multi-version support

## New Components

#### 1. MessageProcessor
- **Purpose**: Centralized message processing pipeline
- **Key Features**:
  - Validates incoming messages
  - Coordinates between prompt building and response handling
  - Manages error handling and logging
  - Handles message context and state

#### 2. PromptBuilder
- **Purpose**: Constructs conversation contexts for AI processing
- **Key Features**:
  - Manages system prompts and conversation history
  - Handles message formatting and context building
  - Supports additional context injection
  - Configurable message history length

#### 3. ResponseHandler
- **Purpose**: Manages bot responses
- **Key Features**:
  - Formats responses for Discord
  - Handles message splitting for long responses
  - Manages different response types (embeds, files, etc.)
  - Implements rate limiting and cooldowns

### Updated Project Roadmap

#### Phase 1: Core Functionality (Q3 2025)
- [x] Set up monorepo structure
- [x] Implement basic Discord bot with slash commands
- [x] Create Next.js frontend with basic chat interface
- [x] Set up CI/CD pipeline with GitHub Actions
- [x] Create a basic Discord bot with slash commands
- [x] Create a basic frontend with chat interface
- [x] Implement MessageProcessor for handling message flow
- [x] Add PromptBuilder for AI context management
- [x] Set up basic response handling
- [ ] Add comprehensive error handling and logging
- [ ] Implement command system enhancements
- [ ] Add user preferences and state management

### Architecture Changes

#### Message Flow
1. Message received via Discord event
2. `MentionBotEvent` validates and forwards to `MessageProcessor`
3. `MessageProcessor` coordinates:
   - Message validation
   - Context building via `PromptBuilder`
   - AI response generation
   - Response handling via `ResponseHandler`
4. Response sent back to Discord

#### Key Improvements
- Better separation of concerns
- More maintainable and testable code
- Easier to extend with new features
- Improved error handling and logging
- More consistent user experience
