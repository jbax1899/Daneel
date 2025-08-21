# Daneel

Daneel (inspired by the android in Isaac Asimov's "Foundation" series) is a comprehensive AI assistant system featuring both a web interface and a Discord bot, built with modern TypeScript.

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
- [x] Implement rate limiting system with user, channel, and guild limits
- [x] Upgrade to GPT-5 for improved responses
- [x] Add detailed token usage tracking and cost estimation
- [X] Custom embed builder
- [X] LLM pre-pass system
- [ ] Allow the bot to respond to other bots
- [ ] Allow the bot to respond to plaintext name (with direction from prepass)
- [ ] Image processing
- [ ] Audio generation
- [ ] Live voice chat via Discord call

## Features

### 🤖 Discord Bot
- Powered by Discord.js 14 with TypeScript
- Custom command and event system
- Advanced message processing pipeline
- AI-powered responses with conversation context
- Robust error handling and logging
- Configurable rate limiting to prevent abuse

### 🌐 Web Client
- Next.js 15 with React 19
- Modern UI with Tailwind CSS and shadcn/ui
- Real-time chat interface with AI SDK
- Secure authentication with Clerk
- Responsive design for all devices

### 🧩 Shared Core
- TypeScript-based shared utilities and types
- Centralized configuration and logging
- Consistent AI model integration
- Common validation schemas

## 🛠️ Technical Stack

### Core
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0+
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

### Development Tools
- Bundler: Turbopack
- Linting: ESLint + Prettier
- CI/CD: GitHub Actions
- Deployment: Fly.io

## 📁 Project Structure

```
daneel/
├── packages/
│   ├── discord-bot/          # Discord bot implementation
│   │   ├── src/
│   │   │   ├── commands/     # Bot command handlers
│   │   │   ├── events/       # Discord event handlers
│   │   │   ├── types/        # TypeScript type definitions
│   │   │   ├── utils/        # Utility functions
│   │   │   └── index.ts      # Bot entry point
│   │
│   ├── frontend/             # Web client application
│   │   └── web/              # Next.js application
│   │       ├── app/          # App router
│   │       ├── components/   # UI components
│   │       └── lib/          # Utility libraries
│   │
│   └── shared/               # Shared code between packages
│       └── src/              # Shared types and utilities
├── .github/                  # GitHub workflows
├── .gitignore
├── package.json              # Root package.json with workspace config
└── README.md
```

## Configuration

### Required Environment Variables

These environment variables must be set in your `.env` file for the bot to function:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token  # Required for bot authentication
CLIENT_ID=your_discord_client_id      # Your Discord application's client ID
GUILD_ID=your_discord_guild_id       # The server (guild) ID where the bot will operate

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key   # Required for AI functionality
```

### Optional Environment Variables

#### Rate Limiting

Daneel includes a configurable rate limiting system to prevent abuse. You can configure the following settings in your `.env` file:

```env
# User rate limiting
RATE_LIMIT_USER=true          # Enable/disable user rate limiting
USER_RATE_LIMIT=5             # Max requests per user per time window
USER_RATE_WINDOW_MS=60000     # Time window in milliseconds (60 seconds)

# Channel rate limiting
RATE_LIMIT_CHANNEL=true       # Enable/disable channel rate limiting
CHANNEL_RATE_LIMIT=10         # Max requests per channel per time window
CHANNEL_RATE_WINDOW_MS=60000  # Time window in milliseconds (60 seconds)

# Guild rate limiting
RATE_LIMIT_GUILD=true         # Enable/disable guild rate limiting
GUILD_RATE_LIMIT=20           # Max requests per guild per time window
GUILD_RATE_WINDOW_MS=60000    # Time window in milliseconds (60 seconds)
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.