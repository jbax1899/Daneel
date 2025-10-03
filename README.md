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

```
daneel/
├── packages/
│   ├── discord-bot/          # Discord bot implementation
│   │   ├── src/
│   │   │   ├── commands/     # Bot command handlers
│   │   │   │   ├── BaseCommand.ts  # Base command class
│   │   │   │   ├── call.ts         # Voice call command
│   │   │   │   ├── help.ts         # Help command
│   │   │   │   ├── image.ts        # Image generation command
│   │   │   │   ├── news.ts         # News fetching command
│   │   │   │   └── ping.ts         # Ping command
│   │   │   │
│   │   │   ├── constants/     # Configuration constants
│   │   │   │   └── voice.ts   # Voice processing constants
│   │   │   │
│   │   │   ├── events/        # Discord event handlers
│   │   │   │   ├── Event.ts        # Base event class
│   │   │   │   ├── MessageCreate.ts # Message processing events
│   │   │   │   └── VoiceStateHandler.ts # Voice state change events
│   │   │   │
│   │   │   ├── output/       # Output directories
│   │   │   │   ├── images/   # Image output storage
│   │   │   │   └── tts/      # Text-to-speech output storage
│   │   │   │
│   │   │   ├── realtime/     # Realtime API integration
│   │   │   │   ├── RealtimeAudioHandler.ts  # Audio processing for OpenAI Realtime
│   │   │   │   ├── RealtimeEventHandler.ts  # Event handling for Realtime API
│   │   │   │   ├── RealtimeSessionConfig.ts # Session configuration
│   │   │   │   ├── RealtimeWebSocketManager.ts # WebSocket connection management
│   │   │   │   └── types.ts    # Realtime API type definitions
│   │   │   │
│   │   │   ├── types/        # TypeScript type definitions
│   │   │   │   └── discord.d.ts # Extended Discord.js type definitions
│   │   │   │
│   │   │   ├── utils/        # Utility functions
│   │   │   │   ├── prompting/ # Prompt construction and management
│   │   │   │   │   ├── ContextBuilder.ts # Builds conversation contexts for AI
│   │   │   │   │   └── Planner.ts  # Determines response strategy (reply/DM/react)
│   │   │   │   │
│   │   │   │   ├── response/  # Response handling
│   │   │   │   │   ├── EmbedBuilder.ts    # Creates and validates Discord embeds
│   │   │   │   │   ├── ResponseHandler.ts # Handles formatting and sending responses
│   │   │   │   │   ├── commandHandler.ts # Command loading and registration
│   │   │   │   │   ├── env.ts          # Environment variable validation
│   │   │   │   │   ├── eventManager.ts # Event manager utilities
│   │   │   │   │   ├── logger.ts       # Logging utilities
│   │   │   │   │   ├── MessageProcessor.ts # Core message processing pipeline
│   │   │   │   │   ├── openaiService.ts # OpenAI API integration
│   │   │   │   │   ├── RateLimiter.ts  # Configurable rate limiting for users, channels, and guilds
│   │   │   │   │   └── realtimeService.ts # Realtime API service utilities
│   │   │   │   │
│   │   │   │   ├── commandHandler.ts # Command loading and registration
│   │   │   │   ├── env.ts          # Environment variable validation
│   │   │   │   ├── eventManager.ts # Event manager utilities
│   │   │   │   ├── logger.ts       # Logging utilities
│   │   │   │   ├── MessageProcessor.ts # Core message processing pipeline
│   │   │   │   ├── openaiService.ts # OpenAI API integration
│   │   │   │   ├── RateLimiter.ts  # Configurable rate limiting for users, channels, and guilds
│   │   │   │   └── realtimeService.ts # Realtime API service utilities
│   │   │   │
│   │   │   ├── voice/        # Voice processing utilities
│   │   │   │   ├── AudioCaptureHandler.ts  # Real-time audio capture and processing
│   │   │   │   ├── AudioPlaybackHandler.ts  # Audio playback to Discord voice channels
│   │   │   │   ├── UserVoiceStateHandler.ts # Processes Discord voice state changes
│   │   │   │   ├── VoiceConnectionManager.ts # Connection utilities and cleanup
│   │   │   │   └── VoiceSessionManager.ts    # Manages voice channel sessions
│   │   │   │
│   │   │   └── index.ts      # Bot entry point
│   │   │
│   │   ├── dist/            # Compiled JavaScript output
│   │   ├── logs/            # Log files
│   │   ├── node_modules/    # Package dependencies
│   │   ├── package.json     # Package configuration
│   │   ├── tsconfig.json    # TypeScript configuration
│   │   └── tsconfig.tsbuildinfo # TypeScript build info
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

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
