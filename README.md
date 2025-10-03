# Daneel

Daneel (inspired by the android in Isaac Asimov's "Foundation" series) is a comprehensive AI assistant system featuring both a web interface and a Discord bot, built with modern TypeScript.

<img width="802" height="172" alt="image" src="https://github.com/user-attachments/assets/a842ed94-6902-4493-a1a1-efc6415c1765" />

https://github.com/user-attachments/assets/fcfd95a2-d956-4b86-a3df-6ef4ac6391fd

## Features

### 🤖 Discord Bot
- Rich bot features with a user-friendly interface (Discord API / Discord.js)
- Command handling, event management, and message processing pipelines
- OpenAI message processing
- Image analysis
- Text-to-speech (TTS) generation
- /news command: Fetches recent articles from across the web; Optional arguments for refining search
- /image command: Generates an image given a prompt; Optional argument for dimensions (square, portrait, landscape)

#### Realtime Voice Chat
- **Seamless voice conversations** with OpenAI's Realtime API
- **Advanced audio processing pipeline** with Discord.js Voice
- **Real-time transcription and response generation**

**How It Works:**

1. **Voice Channel Setup**: Use `/call <voice_channel>` to invite the bot to a voice channel
2. **Connection Management**: The bot joins the channel and establishes voice connections using Discord.js Voice
3. **User Detection**: When you join the voice channel, the bot detects your presence and initiates the conversation
4. **Audio Capture**: Your voice is captured in real-time using Discord's voice receiver
5. **Audio Processing**: Raw audio (Opus format) is decoded to PCM and buffered for processing
6. **OpenAI Integration**: Processed audio is sent to OpenAI's Realtime API for transcription and response generation
7. **Response Playback**: AI responses are converted back to audio and played in the voice channel
8. **Session Management**: Automatic cleanup when users leave or connections are lost

**Technical Architecture:**

The voice chat system is built with a modular architecture following Single Responsibility Principle:

- **VoiceSessionManager**: Manages voice channel sessions and connection lifecycle
- **AudioCaptureHandler**: Handles real-time audio capture and processing from Discord
- **AudioPlaybackHandler**: Manages audio playback to Discord voice channels
- **UserVoiceStateHandler**: Processes Discord voice state changes and user interactions
- **VoiceConnectionManager**: Provides connection utilities and cleanup functionality
- **RealtimeWebSocketManager**: Manages WebSocket connections to OpenAI's API
- **RealtimeAudioHandler**: Handles audio-specific operations with OpenAI
- **RealtimeEventHandler**: Processes events and responses from OpenAI
- **RealtimeSessionConfig**: Manages session configuration and settings

This architecture ensures reliable, natural, low-latency voice conversations with proper error handling and resource management.

<img width="900" height="362" alt="Example of text-to-speech (TTS)" src="https://github.com/user-attachments/assets/b0ce1cc3-e388-408d-9574-4fdc40d540fc" />
<img width="909" height="953" alt="Example of image analysis" src="https://github.com/user-attachments/assets/49cd2df9-ec29-4eee-85bb-2a77f6ba8537" />
<img width="892" height="766" alt="Example of /news command" src="https://github.com/user-attachments/assets/ccd154a8-bb8a-453e-b15c-07f994f741f6" />
<img width="567" height="540" alt="Example of /image command" src="https://github.com/user-attachments/assets/c33798c7-091f-4fba-b483-6231beb0ed8d" />

### 🌐 Web Client
- Next.js 15 with React 19
- Modern UI with Tailwind CSS and shadcn/ui
- Real-time chat interface with AI SDK
- Secure authentication with Clerk
- Responsive design for all devices

<img width="710" height="703" alt="image" src="https://github.com/user-attachments/assets/a388fbc0-9a64-4ebc-8499-65c354e6dcbc" />

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
- [X] Allow the bot to respond to other bots
- [X] Allow the bot to respond to plaintext name
- [X] Audio generation (TTS)
- [X] Image context processing
- [X] Web search
- [X] /news command
- [X] Plan reduces conversation history tokens to fit more context
- [X] Live voice chat via Discord call
- [ ] Cache chain of thought
- [ ] Opt-in, user-deletable memory

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

## 📁 Project Structure

```text
daneel/
├── .dockerignore             # Build context exclusions for Docker
├── .github/                  # GitHub Actions workflows and templates
├── .gitignore                # Git ignore patterns
├── .vscode/                  # VS Code workspace defaults
├── .windsurf/                # Cascade/Windsurf agent configuration
├── BuildRepoInitial.js          # Script to chunk repository files and upsert Pinecone embeddings
├── CreatePineconeIndex.js       # One-off helper to create the Pinecone index used for repo search
├── Dockerfile                   # Container image definition for deployments
├── fly.toml                     # Fly.io application configuration
├── package.json                 # Root workspaces + scripts
├── tsconfig.json                # Base TypeScript configuration
├── reference/                 # Scratchpad + design reference material
├── packages/
│   ├── discord-bot/             # Active Discord bot workspace
│   │   ├── package.json         # Bot-specific dependencies and scripts
│   │   ├── tsconfig.json        # Bot TypeScript compiler options
│   │   ├── dist/                # Build output (generated)
│   │   ├── logs/                # Winston log files (gitignored)
│   │   └── src/
│   │       ├── index.ts         # Bootstraps the Discord client and wiring
│   │       ├── commands/        # Slash command implementations
│   │       │   ├── BaseCommand.ts # Command interface/typing helper
│   │       │   ├── call.ts        # `/call` voice-channel pilot (joins/tears down voice calls)
│   │       │   ├── help.ts        # `/help` command with dynamic command listing
│   │       │   ├── image.ts       # `/image` command backed by OpenAI image generation + Cloudinary
│   │       │   ├── news.ts        # `/news` command that orchestrates web search + formatted embeds
│   │       │   └── ping.ts        # `/ping` health-check responder
│   │       ├── events/          # Discord gateway event handlers
│   │       │   ├── Event.ts       # Abstract base for typed event registration
│   │       │   └── MessageCreate.ts # Message listener that drives planning + responses
│   │       ├── types/           # Local ambient type augmentations
│   │       │   └── discord.d.ts   # Extends the Discord client with a command cache
│   │       └── utils/           # Core bot services + infrastructure
│   │           ├── MessageProcessor.ts # Main pipeline (context, planning, response orchestration)
│   │           ├── RateLimiter.ts     # Generic rate-limiter + `/image` cooldown helper
│   │           ├── commandHandler.ts  # Dynamic loader + deployer for slash commands
│   │           ├── env.ts             # Environment-variable loading/validation
│   │           ├── eventManager.ts    # Dynamic loader/binder for gateway events
│   │           ├── logger.ts          # Winston logger configuration
│   │           ├── openaiService.ts   # GPT-5 integration, embeddings, TTS, image captions
│   │           ├── prompting/         # Planning + context helpers
│   │           │   ├── ContextBuilder.ts # Builds trimmed conversation context w/ summarization
│   │           │   └── Planner.ts        # Planning LLM that selects actions + presence
│   │           └── response/          # Outbound messaging helpers
│   │               ├── EmbedBuilder.ts   # Safer embed builder wrapper with validation
│   │               └── ResponseHandler.ts # Shared helpers for replying, typing, presence
│   ├── frontend/              # Next.js assistant UI (currently on pause)
│   │   └── web/               # React app using assistant-ui & Clerk
│   └── shared/                # Placeholder for cross-package utilities
└── README.md
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
