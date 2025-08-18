# Daneel

Daneel (inspired by the android in Isaac Asimov's "Foundation" series) is a comprehensive AI assistant system featuring both a web interface and a Discord bot. Built with modern TypeScript and a monorepo architecture using npm workspaces for code organization and sharing.

## Project Status

### Current Phase: Core Functionality (Q3 2025)

#### Completed
- Set up monorepo structure
- Implemented basic Discord bot with slash commands
- Created Next.js frontend with basic chat interface
- Set up CI/CD pipeline with GitHub Actions
- Implemented MessageProcessor for handling message flow
- Added PromptBuilder for AI context management
- Implemented ResponseHandler for centralized response management

#### In Progress
- Rate limiting system
- Basic moderation commands

## Features

### 🤖 Discord Bot
- Powered by Discord.js 14 with TypeScript
- Custom command and event system
- Advanced message processing pipeline
- AI-powered responses with conversation context
- Robust error handling and logging

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
│   ├── discord-bot/    # Discord bot implementation
│   │   ├── src/
│   │   │   ├── commands/     # Bot command handlers
│   │   │   ├── events/       # Discord event handlers
│   │   │   ├── types/        # TypeScript type definitions
│   │   │   ├── utils/        # Utility functions
│   │   │   └── index.ts      # Bot entry point
│   │
│   ├── frontend/       # Web client application
│   │   └── web/        # Next.js application
│   │       ├── app/    # App router
│   │       ├── components/  # UI components
│   │       └── lib/    # Utility libraries
│   │
│   └── shared/         # Shared code between packages
│       └── src/        # Shared types and utilities
├── .github/            # GitHub workflows
├── .gitignore
├── package.json        # Root package.json with workspace config
└── README.md
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.