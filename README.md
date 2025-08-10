# Daneel

Daneel is an advanced AI assistant built with a modern TypeScript stack, featuring both a web interface and a Discord bot. The project is built on a monorepo architecture using npm workspaces for better code organization and sharing.

## Features

### Discord Bot
- Powered by discord.js for seamless Discord integration
- Utilizes a fine-tuned OpenAI model for personalized responses
- Maintains conversation context for more natural interactions
- Supports both direct mentions and replies for interaction

### Web Client
- Modern React-based frontend with TypeScript
- Responsive UI with Tailwind CSS
- Real-time chat interface
- File upload capabilities

### Shared Core
- TypeScript-based shared utilities and types
- Consistent AI model integration across platforms
- Centralized configuration

## Project Structure

```
daneel/
├── packages/
│   ├── discord-bot/    # Discord bot implementation
│   ├── frontend/       # Web client application
│   └── shared/         # Shared code and utilities
├── .gitignore
├── package.json        # Root package.json with workspace config
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- OpenAI API key
- Discord Bot Token

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd daneel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add your OpenAI API key and Discord bot token

### Development

Start the development servers for both frontend and backend:
```bash
npm run start:dev
```

Build all packages for production:
```bash
npm run build
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Discord
DISCORD_TOKEN=your_discord_bot_token
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.