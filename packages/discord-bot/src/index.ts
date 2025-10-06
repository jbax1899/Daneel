import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { EventManager } from './utils/eventManager.js';
import { logger } from './utils/logger.js';
import { config } from './utils/env.js';
import { OpenAIService } from './utils/openaiService.js';
import { imageCommandRateLimiter } from './utils/RateLimiter.js';
import { evictFollowUpContext, readFollowUpContext, saveFollowUpContext } from './commands/image/followUpCache.js';
import { runImageGenerationSession } from './commands/image.js';
import { IMAGE_RETRY_CUSTOM_ID_PREFIX, IMAGE_VARIATION_CUSTOM_ID_PREFIX } from './commands/image/constants.js';
import {
  buildImageResultPresentation,
  createRetryButtonRow,
  executeImageGeneration,
  formatRetryCountdown
} from './commands/image/sessionHelpers.js';
import { recoverContextFromMessage } from './commands/image/contextResolver.js';
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

// Initialize client handlers
client.handlers = new Collection();

// VoiceStateHandler will be instantiated by EventManager (auto-registers itself to client.handlers)

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
  if (interaction.isChatInputCommand()) {
    const command = (interaction.client as any).commands?.get(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    logger.info(`Executing command: ${interaction.commandName}`);

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}: ${error}`);
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith(IMAGE_VARIATION_CUSTOM_ID_PREFIX)) {
      const followUpResponseId = interaction.customId.slice(IMAGE_VARIATION_CUSTOM_ID_PREFIX.length);
      if (!followUpResponseId) {
        await interaction.reply({ content: '⚠️ I could not determine which image to vary.', ephemeral: true });
        return;
      }

      let cachedContext = readFollowUpContext(followUpResponseId);

      if (!cachedContext) {
        try {
          const recovered = await recoverContextFromMessage(interaction.message);
          if (recovered) {
            cachedContext = recovered;
            saveFollowUpContext(followUpResponseId, recovered);
          }
        } catch (error) {
          logger.error('Failed to recover cached context for variation button:', error);
        }
      }

      if (!cachedContext) {
        await interaction.reply({ content: '⚠️ Sorry, I can no longer create a variation for that image. Please run /image again.', ephemeral: true });
        return;
      }

      const isDeveloper = interaction.user.id === process.env.DEVELOPER_USER_ID;

      if (!isDeveloper) {
        const { allowed, retryAfter, error } = imageCommandRateLimiter.checkRateLimitImageCommand(interaction.user.id);
        if (!allowed) {
          const countdown = formatRetryCountdown(retryAfter ?? 0);
          await interaction.reply({ content: `⚠️ ${error} Try again in ${countdown}.`, ephemeral: true });
          return;
        }
      }

      try {
        await runImageGenerationSession(interaction, cachedContext, followUpResponseId);
      } catch (error) {
        logger.error('Unexpected error while handling image variation button:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '⚠️ Something went wrong while starting that variation.', ephemeral: true });
        }
      }

      return;
    }

    if (interaction.customId.startsWith(IMAGE_RETRY_CUSTOM_ID_PREFIX)) {
      const retryKey = interaction.customId.slice(IMAGE_RETRY_CUSTOM_ID_PREFIX.length);
      if (!retryKey) {
        await interaction.reply({ content: '⚠️ I could not find that image request to retry.', ephemeral: true });
        return;
      }

      const cachedContext = readFollowUpContext(retryKey);
      if (!cachedContext) {
        await interaction.reply({ content: '⚠️ Sorry, that retry expired. Please ask me to generate a new image.', ephemeral: true });
        return;
      }

      const isDeveloper = interaction.user.id === process.env.DEVELOPER_USER_ID;
      if (!isDeveloper) {
        const { allowed, retryAfter, error } = imageCommandRateLimiter.checkRateLimitImageCommand(interaction.user.id);
        if (!allowed) {
          const countdown = formatRetryCountdown(retryAfter ?? 0);
          const retryRow = createRetryButtonRow(retryKey, countdown);
          try {
            await interaction.update({ content: `⚠️ ${error} Try again in ${countdown}.`, components: [retryRow] });
          } catch {
            await interaction.reply({ content: `⚠️ ${error} Try again in ${countdown}.`, ephemeral: true });
          }
          return;
        }
      }

      await interaction.deferReply();

      try {
        await interaction.message.edit({ components: [] }).catch(() => undefined);

        const artifacts = await executeImageGeneration(cachedContext, {
          user: {
            username: interaction.user.username,
            nickname: interaction.user.displayName ?? interaction.user.username,
            guildName: interaction.guild?.name ?? `No guild for ${interaction.type} interaction`
          }
        });

        const presentation = buildImageResultPresentation(cachedContext, artifacts);

        if (artifacts.responseId) {
          saveFollowUpContext(artifacts.responseId, presentation.followUpContext);
        }
        evictFollowUpContext(retryKey);

        await interaction.editReply({
          content: presentation.content,
          embeds: [presentation.embed],
          files: presentation.attachments,
          attachments: [],
          components: presentation.components
        });
      } catch (error) {
        logger.error('Unexpected error while handling image retry button:', error);
        try {
          await interaction.editReply({ content: '⚠️ I was unable to generate that image. Please try again later.', components: [] });
        } catch (replyError) {
          logger.error('Failed to send retry failure message:', replyError);
        }
      }

      return;
    }
  }
});

// ====================
// Handle Uncaught Exceptions
// ====================
process.on('unhandledRejection', (error: Error) => {
  logger.error(`Unhandled promise rejection: ${error}`);
});

process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught exception: ${error}`);
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
    console.error(`Webhook processing error: ${err}`);
    res.sendStatus(500);
  }
});

// Start Express server
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3000;
appServer.listen(WEBHOOK_PORT, () => {
  console.log(`GitHub webhook server listening on port ${WEBHOOK_PORT}`);
});
*/