import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { EventManager } from './utils/eventManager.js';
import { logger } from './utils/logger.js';

// ====================
// Environment Setup
// ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ 
  path: path.resolve(__dirname, '../../../.env') 
});

// Validate required environment variables
const REQUIRED_ENV_VARS = [
  'DISCORD_TOKEN', 
  'CLIENT_ID', 
  'GUILD_ID', 
  'OPENAI_API_KEY'
] as const;

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// ====================
// Client Configuration
// ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  presence: { status: 'online' }
});

// ====================
// Initialize Managers
// ====================
const commandHandler = new CommandHandler();
const eventManager = new EventManager(client);

// ====================
// Load and Register Commands
// ====================
try {
  logger.info('Loading commands...');
  const commands = await commandHandler.loadCommands();
  
  // Deploy commands to Discord
  await commandHandler.deployCommands(
    process.env.DISCORD_TOKEN!,
    process.env.CLIENT_ID!,
    process.env.GUILD_ID!
  );
  
  // Store commands in memory for execution
  commands.forEach((cmd, name) => {
    (client as any).commands = (client as any).commands || new Map();
    (client as any).commands.set(name, cmd);
  });
  
  logger.info(`Successfully loaded and registered ${commands.size} commands`);
} catch (error) {
  logger.error('Failed to load/deploy commands:', error);
  process.exit(1);
}

// ====================
// Load Events
// ====================
const eventsPath = path.join(__dirname, 'events');
await eventManager.loadEvents(eventsPath);
eventManager.registerAll();

// ====================
// Start the Bot
// ====================
client.login(process.env.DISCORD_TOKEN!);

// ====================
// Process Handlers
// ====================
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Client ready handler
client.once(Events.ClientReady, () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
});

// Slash commands handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const command = (interaction.client as any).commands?.get(interaction.commandName);

    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`);
      return interaction.reply({
        content: 'This command is not available.',
        ephemeral: true
      });
    }

    logger.info(`Executing command: ${interaction.commandName}`);
    return command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}`, error);
    
    const reply = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(reply);
    } else {
      return interaction.reply(reply);
    }
  }
});