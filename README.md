# Daneel

Daneel (inspired by the android in Isaac Asimov's "Foundation" series) is a comprehensive AI assistant system featuring both a web interface and a Discord bot, built with modern TypeScript.

https://github.com/user-attachments/assets/fcfd95a2-d956-4b86-a3df-6ef4ac6391fd

## Features

### 🤖 Discord Bot
- Rich bot features with a user-friendly interface (Discord API / Discord.js)
- Natural message processing and responses
- Image analysis
- Text-to-speech (TTS) generation
- /news command: Fetches recent articles from across the web
- /image command: Generates an image given a prompt
- Seamless voice chat conversations (OpenAI Realtime API)

<img width="900" height="362" alt="Example of text-to-speech (TTS)" src="https://github.com/user-attachments/assets/b0ce1cc3-e388-408d-9574-4fdc40d540fc" />
<img width="892" height="766" alt="Example of /news command" src="https://github.com/user-attachments/assets/ccd154a8-bb8a-453e-b15c-07f994f741f6" />
<img width="909" height="953" alt="Example of image analysis" src="https://github.com/user-attachments/assets/49cd2df9-ec29-4eee-85bb-2a77f6ba8537" />
<img width="646" height="985" alt="image" src="https://github.com/user-attachments/assets/320f317f-4615-4d15-9820-dc02f345b005" />

### 🌐 Web Interface
- Project landing page
- Settings configuration (coming soon)

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
