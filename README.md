# Daneel

Daneel (inspired by the android in Isaac Asimov's "Foundation" series) is a comprehensive AI assistant system featuring both a web interface and a Discord bot, built with modern TypeScript.

https://github.com/user-attachments/assets/fcfd95a2-d956-4b86-a3df-6ef4ac6391fd

## Local development quickstart

The landing page now lives inside the `@ai-assistant/daneel-site` Vite workspace. To work on it locally:

1. Install dependencies from the repository root: `npm install`
2. Start the development server: `npm run dev -w @ai-assistant/daneel-site`
3. Visit http://localhost:3000 to preview changes with hot reloads

When you are ready to test the production bundle locally:

- Build the static assets: `npm run build -w @ai-assistant/daneel-site`
- Preview the production output: `npm run preview -w @ai-assistant/daneel-site`

These commands mirror the Fly.io build pipeline, so a successful preview means the Docker image will also have the compiled assets it needs.

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

#### Image Generation

The `/image` command exposes several environment hooks so you can fine-tune the
default models and token economy without editing source code:

```env
# Defaults for slash commands, planner flows, and manual variations
IMAGE_DEFAULT_TEXT_MODEL=gpt-4.1-mini
IMAGE_DEFAULT_IMAGE_MODEL=gpt-image-1-mini

# Token bucket configuration
IMAGE_TOKENS_PER_REFRESH=10
IMAGE_TOKEN_REFRESH_INTERVAL_MS=86400000  # 24 hours

# Per-model token multipliers (either JSON or individual overrides)
IMAGE_MODEL_MULTIPLIERS={"gpt-image-1":2,"gpt-image-1-mini":1}
IMAGE_MODEL_MULTIPLIER_GPT_IMAGE_1=2
IMAGE_MODEL_MULTIPLIER_GPT_IMAGE_1_MINI=1
```

> ℹ️ **Tip:** When using the `IMAGE_MODEL_MULTIPLIER_<MODEL>` format, replace
> hyphens in the model name with underscores (for example,
> `gpt-image-1-mini` → `IMAGE_MODEL_MULTIPLIER_GPT_IMAGE_1_MINI`). JSON and
> individual overrides can be mixed—the last matching entry wins.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
