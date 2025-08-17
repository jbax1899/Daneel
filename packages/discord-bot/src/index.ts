// Core dependencies
import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Utils
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
const log = logger;

// Initialize commands collection
client.commands = new Collection();

// ====================
// Event Registration
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
  log.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  log.error('Uncaught exception:', error);
  process.exit(1);
});

// Client ready handler
client.once(Events.ClientReady, async () => {
  log.info(`Logged in as ${client.user?.tag}!`);
  
  try {
    // Load and register commands
    const commands = await commandHandler.loadCommands();
    commands.forEach((cmd, name) => {
      client.commands?.set(name, cmd);
    });
    log.info(`Registered ${commands.size} commands in client`);
    
    // Deploy commands to Discord
    await commandHandler.deployCommands(
      process.env.DISCORD_TOKEN!,
      process.env.CLIENT_ID!,
      process.env.GUILD_ID!
    );
  } catch (error) {
    log.error('Error during startup:', error);
    process.exit(1);
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const command = (interaction.client as any).commands?.get(interaction.commandName);

    if (!command) {
      log.warn(`No command matching ${interaction.commandName} was found.`);
      return interaction.reply({
        content: 'This command is not available.',
        flags: 'Ephemeral'
      });
    }

    log.info(`Executing command: ${interaction.commandName}`);
    return command.execute(interaction);
  } catch (error) {
    log.error(`Error executing ${interaction.commandName}`, error);
    
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