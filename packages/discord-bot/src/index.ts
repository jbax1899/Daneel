import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { logger } from './utils/logger.js';
import { Collection } from '@discordjs/collection';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Ensure required environment variables are loaded
const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`${varName} is not defined in the environment variables`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  presence: {
    status: 'online'
  }
});

// Initialize commands collection on the client
client.commands = new Collection();

const commandHandler = new CommandHandler();

client.once(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user?.tag}!`);
  
  try {
    // Load commands first
    const commands = await commandHandler.loadCommands();
    
    // Store commands in the client for access in commands
    commands.forEach((cmd, name) => {
      client.commands?.set(name, cmd);
    });
    
    logger.info(`Registered ${commands.size} commands in client`);
    
    // Then deploy them
    await commandHandler.deployCommands(
      process.env.DISCORD_TOKEN!,
      process.env.CLIENT_ID!,
      process.env.GUILD_ID!
    );
  } catch (error) {
    logger.error('Error during startup:', error);
    process.exit(1);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const command = (interaction.client as any).commands?.get(interaction.commandName);

    if (!command) {
      logger.warn(`No command matching ${interaction.commandName} was found.`);
      return interaction.reply({
        content: 'This command is not available.',
        flags: 'Ephemeral'
      });
    }

    logger.info(`Executing command: ${interaction.commandName}`);
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}`, error);
    
    const reply = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Handle uncaught exceptions
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});