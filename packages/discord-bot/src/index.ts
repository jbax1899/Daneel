import { Client, GatewayIntentBits, Events } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { EventManager } from './utils/eventManager.js';
import { logger } from './utils/logger.js';
import { config } from './utils/env.js';
import { OpenAIService } from './utils/openaiService.js';
//import express from 'express'; // For webhook
//import bodyParser from "body-parser"; // For webhook

// ====================
// Environment Setup
// ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI service
export const openaiService = new OpenAIService(config.openaiApiKey); // Exported for use in other files, like /news command

// ====================
// Client Configuration
// ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  presence: { status: 'online' }
});

// ====================
// Initialize Managers
// ====================
const commandHandler = new CommandHandler();
const eventManager = new EventManager(client, { 
  openai: { apiKey: config.openaiApiKey },
  openaiService 
});

// ====================
// Load and Register Commands
// ====================

// Use an async IIFE to handle top-level await
(async () => {
  try {
    // Load commands first
    const commands = await commandHandler.loadCommands();
    
    // Deploy commands to Discord
    logger.debug('Deploying commands to Discord...');
    await commandHandler.deployCommands(
      config.token,
      config.clientId,
      config.guildId
    );
    
    // Store commands in memory for execution
    commands.forEach((cmd, name) => {
      (client as any).commands = (client as any).commands || new Map();
      (client as any).commands.set(name, cmd);
      logger.debug(`Command stored in memory: ${name}`);
    });

    // Load events after commands are registered
    logger.debug('Loading events...');
    await eventManager.loadEvents(__dirname + '/events');
    eventManager.registerAll();
    logger.debug('Events loaded and registered.');

    // Login to Discord after everything is set up
    logger.debug('Logging in to Discord...');
    await client.login(config.token);
    logger.info('Bot is now connected to Discord and ready!');
  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
})();

// ====================
// Process Handlers
// ====================

// Client ready handler
client.once(Events.ClientReady, () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

// Slash commands handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as any).commands?.get(interaction.commandName);

  if (!command) {
    logger.warn(`No command matching ${interaction.commandName} was found.`);
    // Only try to reply if not already handled
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: 'This command is not available.',
        flags: [1 << 6] // EPHEMERAL
      }).catch(console.error);
    }
    return;
  }

  logger.info(`Executing command: ${interaction.commandName}`);
  
  try {
    // Let the command handle its own defer/reply logic
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);
    
    // Only try to send an error message if we haven't already replied
    if (!interaction.replied) {
      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: 'There was an error executing this command!'
          });
        } else {
          await interaction.reply({
            content: 'There was an error executing this command!',
            flags: [1 << 6] // EPHEMERAL
          });
        }
      } catch (replyError) {
        logger.error(`Failed to send error message:`, replyError);
      }
    }
  }
});

// ====================
// Handle Uncaught Exceptions
// ====================
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// ====================
// GitHub Webhook Server
// ====================
//TODO: Need to implement system of actually updating the vector database with the changes. Currently the system is just to delete/replace the entire database.
/*
const appServer = express();
appServer.use(bodyParser.json());

appServer.post("/github-webhook", async (req, res) => {
  try {
    const { ref, commits } = req.body;
    console.log(`Push detected on ${ref}`);

    const changedFiles = commits.flatMap((c: any) => [...c.added, ...c.modified]);
    console.log(`Changed files: ${changedFiles.join(', ')}`);

    // Trigger reindexing asynchronously
    // TODO

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.sendStatus(500);
  }
});

// Start Express server
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3000;
appServer.listen(WEBHOOK_PORT, () => {
  console.log(`GitHub webhook server listening on port ${WEBHOOK_PORT}`);
});
*/