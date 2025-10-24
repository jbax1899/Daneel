import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Message
} from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { EventManager } from './utils/eventManager.js';
import { logger } from './utils/logger.js';
import { config } from './utils/env.js';
import { OpenAIService } from './utils/openaiService.js';
import { defaultTraceStore } from '@arete/shared';
import type { ResponseMetadata } from 'ethics-core';
import { evictFollowUpContext, readFollowUpContext, saveFollowUpContext } from './commands/image/followUpCache.js';
import { runImageGenerationSession } from './commands/image.js';
import {
  IMAGE_RETRY_CUSTOM_ID_PREFIX,
  IMAGE_VARIATION_ASPECT_SELECT_PREFIX,
  IMAGE_VARIATION_CANCEL_CUSTOM_ID_PREFIX,
  IMAGE_VARIATION_GENERATE_CUSTOM_ID_PREFIX,
  IMAGE_VARIATION_PROMPT_INPUT_ID,
  IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX,
  IMAGE_VARIATION_QUALITY_SELECT_PREFIX,
  IMAGE_VARIATION_RESET_PROMPT_CUSTOM_ID_PREFIX,
  IMAGE_VARIATION_PROMPT_ADJUST_SELECT_PREFIX,
  IMAGE_VARIATION_IMAGE_MODEL_SELECT_PREFIX,
  IMAGE_VARIATION_CUSTOM_ID_PREFIX
} from './commands/image/constants.js';
import {
  buildImageResultPresentation,
  clampPromptForContext,
  createRetryButtonRow,
  executeImageGeneration,
  formatRetryCountdown
} from './commands/image/sessionHelpers.js';
import { recoverContextFromMessage } from './commands/image/contextResolver.js';
import {
  applyVariationCooldown,
  buildPromptModal,
  buildVariationConfiguratorView,
  disposeVariationSession,
  getVariationSession,
  initialiseVariationSession,
  resetVariationCooldown,
  setVariationSessionUpdater,
  updateVariationSession
} from './commands/image/variationSessions.js';
import { resolveAspectRatioSettings } from './commands/image/aspect.js';
import {
  buildTokenSummaryLine,
  consumeImageTokens,
  describeTokenAvailability,
  refundImageTokens
} from './utils/imageTokens.js';
import {
  ALTERNATIVE_LENS_MODAL_PREFIX,
  ALTERNATIVE_LENS_SELECT_PREFIX,
  ALTERNATIVE_LENS_SUBMIT_PREFIX,
  buildLensPayload,
  clearAlternativeLensSession,
  createAlternativeLensSession,
  generateAlternativeLensMessage,
  getAlternativeLensDefinitions,
  getAlternativeLensDefinition,
  getAlternativeLensSession,
  setAlternativeLensCustomDescription,
  setAlternativeLensSelection,
  type AlternativeLensKey
} from './utils/response/provenanceInteractions.js';
//import express from 'express'; // For webhook
//import bodyParser from "body-parser"; // For webhook

// ====================
// Environment Setup
// ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI service
export const openaiService = new OpenAIService(config.openaiApiKey); // Exported for use in other files, like /news command

const ALT_LENS_CUSTOM_DESCRIPTION_INPUT_ID = 'alt_lens_custom_description';

const buildAlternativeLensSessionKey = (userId: string, messageId: string) => `${userId}:${messageId}`;
const DISCORD_MAX_CONTENT_LENGTH = 2000;

function extractResponseIdFromFooterText(footerText?: string | null): string | null {
  if (!footerText) {
    return null;
  }

  const match = footerText.match(/^([\w.-]+)\W+([\w.-]+)\W+([\w-]+)\W+/);
  return match?.[3] ?? null;
}

function deriveResponseIdFromMessage(message: Message | null): string | null {
  if (!message) {
    return null;
  }

  for (const embed of message.embeds ?? []) {
    const responseId = extractResponseIdFromFooterText(embed.footer?.text);
    if (responseId) {
      return responseId;
    }
  }

  return null;
}

async function resolveProvenanceMetadata(message: Message): Promise<{ responseId?: string; metadata: ResponseMetadata | null }> {
  const responseId = deriveResponseIdFromMessage(message);
  if (!responseId) {
    return { metadata: null };
  }

  try {
    const metadata = await defaultTraceStore.retrieve(responseId);
    return { responseId, metadata };
  } catch (error) {
    logger.warn(`Failed to load provenance metadata for response ${responseId}:`, error);
    return { responseId, metadata: null };
  }
}

async function recoverFullMessageText(message: Message): Promise<string> {
  const directContent = message.content?.trim();
  if (directContent) {
    return directContent;
  }

  const referencedId = message.reference?.messageId;
  if (referencedId && message.channel.isTextBased()) {
    try {
      const referenced = await message.channel.messages.fetch(referencedId);
      if (referenced?.content?.trim()) {
        return referenced.content.trim();
      }
    } catch (error) {
      logger.warn(`Failed to fetch referenced message ${referencedId} while preparing alternative lens:`, error);
    }
  }

  return '';
}

function splitContentForDiscord(content: string, maxLength: number = DISCORD_MAX_CONTENT_LENGTH): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxLength) {
    let breakIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (breakIndex <= 0) {
      breakIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (breakIndex <= 0) {
      breakIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (breakIndex <= 0) {
      breakIndex = maxLength;
    }

    let chunk = remaining.slice(0, breakIndex).trimEnd();
    if (!chunk) {
      chunk = remaining.slice(0, maxLength);
      breakIndex = maxLength;
    }

    chunks.push(chunk);
    remaining = remaining.slice(breakIndex).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

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

/**
 * Builds the status message that appears at the top of the variation
 * configurator. We always surface the caller's remaining tokens so they can
 * immediately see how many high-quality attempts remain before the next refill.
 */
function buildVariationStatusMessage(userId: string, base?: string): string {
  const isDeveloper = userId === process.env.DEVELOPER_USER_ID;
  if (isDeveloper) {
    return base
      ? `${base}\n\nDeveloper bypass active—image tokens are not required.`
      : 'Developer bypass active—image tokens are not required.';
  }

  const summary = buildTokenSummaryLine(userId);
  return base ? `${base}\n\n${summary}` : summary;
}

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

  if (interaction.isStringSelectMenu()) {
    const { customId, values } = interaction;
    const selected = values?.[0];

    if (!selected) {
      await interaction.deferUpdate();
      return;
    }


    if (customId.startsWith(ALTERNATIVE_LENS_SELECT_PREFIX)) {
      const messageId = customId.slice(ALTERNATIVE_LENS_SELECT_PREFIX.length);
      const lensDefinition = getAlternativeLensDefinition(selected as AlternativeLensKey);

      if (!lensDefinition) {
        await interaction.reply({
          content: 'That lens is no longer available. Please choose a different option.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const sessionKey = buildAlternativeLensSessionKey(interaction.user.id, messageId);
      const session = setAlternativeLensSelection(sessionKey, lensDefinition.key);
      if (!session) {
        await interaction.reply({
          content: 'That alternative lens session expired. Click **Alternative Lens** again to restart.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      if (lensDefinition.requiresCustomDescription) {
        const modal = new ModalBuilder()
          .setCustomId(`${ALTERNATIVE_LENS_MODAL_PREFIX}${messageId}`)
          .setTitle('Custom Lens Details');
        const input = new TextInputBuilder()
          .setCustomId(ALT_LENS_CUSTOM_DESCRIPTION_INPUT_ID)
          .setLabel('Describe the custom lens')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explain the perspective you want to apply.')
          .setMinLength(10)
          .setMaxLength(500);

        if (session.customDescription) {
          input.setValue(session.customDescription);
        }

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        return;
      }

      await interaction.deferUpdate();
      return;
    }

    const respondWithExpiryNotice = async () => {
      await interaction.reply({ 
        content: '⚠️ That variation configurator expired. Press the variation button again.',
        flags: [1 << 6] // [1 << 6] = EPHEMERAL
      });
    };

    if (customId.startsWith(IMAGE_VARIATION_QUALITY_SELECT_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_QUALITY_SELECT_PREFIX.length);
      const session = updateVariationSession(interaction.user.id, responseId, current => {
        current.quality = selected as any;
      });

      if (!session) {
        await respondWithExpiryNotice();
        return;
      }

      const refreshed = resetVariationCooldown(interaction.user.id, responseId) ?? session;
      await interaction.update(
        buildVariationConfiguratorView(refreshed, {
          statusMessage: buildVariationStatusMessage(interaction.user.id)
        })
      );
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_ASPECT_SELECT_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_ASPECT_SELECT_PREFIX.length);
      const session = updateVariationSession(interaction.user.id, responseId, current => {
        const { size, aspectRatio, aspectRatioLabel } = resolveAspectRatioSettings(selected as any);
        current.size = size;
        current.aspectRatio = aspectRatio;
        current.aspectRatioLabel = aspectRatioLabel;
      });

      if (!session) {
        await respondWithExpiryNotice();
        return;
      }

      const refreshed = resetVariationCooldown(interaction.user.id, responseId) ?? session;
      await interaction.update(
        buildVariationConfiguratorView(refreshed, {
          statusMessage: buildVariationStatusMessage(interaction.user.id)
        })
      );
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_IMAGE_MODEL_SELECT_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_IMAGE_MODEL_SELECT_PREFIX.length);
      const session = updateVariationSession(interaction.user.id, responseId, current => {
        current.imageModel = selected as any;
      });

      if (!session) {
        await respondWithExpiryNotice();
        return;
      }

      const refreshed = resetVariationCooldown(interaction.user.id, responseId) ?? session;
      await interaction.update(
        buildVariationConfiguratorView(refreshed, {
          statusMessage: buildVariationStatusMessage(interaction.user.id)
        })
      );
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_PROMPT_ADJUST_SELECT_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_PROMPT_ADJUST_SELECT_PREFIX.length);
      const session = updateVariationSession(interaction.user.id, responseId, current => {
        current.allowPromptAdjustment = selected === 'allow';
      });

      if (!session) {
        await respondWithExpiryNotice();
        return;
      }

      const refreshed = resetVariationCooldown(interaction.user.id, responseId) ?? session;
      await interaction.update(
        buildVariationConfiguratorView(refreshed, {
          statusMessage: buildVariationStatusMessage(interaction.user.id)
        })
      );
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    const { customId } = interaction;


    if (customId.startsWith(ALTERNATIVE_LENS_MODAL_PREFIX)) {
      const messageId = customId.slice(ALTERNATIVE_LENS_MODAL_PREFIX.length);
      const sessionKey = buildAlternativeLensSessionKey(interaction.user.id, messageId);
      const session = getAlternativeLensSession(sessionKey);

      if (!session) {
        await interaction.reply({
          content: 'That alternative lens session expired. Click **Alternative Lens** again to restart.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const description = interaction.fields.getTextInputValue(ALT_LENS_CUSTOM_DESCRIPTION_INPUT_ID).trim();
      if (!description) {
        await interaction.reply({
          content: 'Please describe your custom lens before submitting.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      setAlternativeLensSelection(sessionKey, 'CUSTOM');
      setAlternativeLensCustomDescription(sessionKey, description);
      await interaction.reply({
        content: 'Custom lens saved. Press Submit when you are ready to generate the alternative perspective.',
        flags: [1 << 6] // [1 << 6] = EPHEMERAL
      });
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX.length);
      const rawPrompt = interaction.fields.getTextInputValue(IMAGE_VARIATION_PROMPT_INPUT_ID);
      const trimmedPrompt = rawPrompt?.trim();

      if (!trimmedPrompt) {
        await interaction.reply({ 
          content: '⚠️ The prompt cannot be empty.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const session = updateVariationSession(interaction.user.id, responseId, current => {
        const normalized = clampPromptForContext(trimmedPrompt);
        current.prompt = normalized;
        current.refinedPrompt = normalized;
      });

      if (!session) {
        await interaction.reply({
          content: '⚠️ That variation configurator expired. Press the variation button again.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const refreshed = resetVariationCooldown(interaction.user.id, responseId) ?? session;
      try {
        if (refreshed.messageUpdater) {
          await refreshed.messageUpdater(
            buildVariationConfiguratorView(refreshed, {
              statusMessage: buildVariationStatusMessage(interaction.user.id)
            })
          );
        }
      } catch (error) {
        logger.warn('Failed to refresh variation configurator after prompt update:', error);
      }

      await interaction.reply({ 
        content: '✅ Prompt updated! Adjust other settings and press **Generate variation** when ready.', 
        flags: [1 << 6] // [1 << 6] = EPHEMERAL
      });
      return;
    }
  }

  // ====================
  // Button Interactions
  // ====================
  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId === 'alternative_lens') {
      try {
        const messageText = await recoverFullMessageText(interaction.message);
        if (!messageText) {
          await interaction.reply({
            content: 'I could not find the response text to reinterpret. Please try again from the original message.',
            flags: [1 << 6] // [1 << 6] = EPHEMERAL
          });
          return;
        }

        const { responseId, metadata } = await resolveProvenanceMetadata(interaction.message);
        const sessionKey = buildAlternativeLensSessionKey(interaction.user.id, interaction.message.id);
        clearAlternativeLensSession(sessionKey);
        createAlternativeLensSession(sessionKey, {
          messageText,
          metadata,
          messageId: interaction.message.id,
          channelId: interaction.message.channelId,
          responseId
        });

        const selectOptions = getAlternativeLensDefinitions();
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`${ALTERNATIVE_LENS_SELECT_PREFIX}${interaction.message.id}`)
          .setPlaceholder('Choose a lens')
          .addOptions(
            selectOptions.map(option => new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setValue(option.key)
              .setDescription(option.description.length > 100 ? `${option.description.slice(0, 97)}...` : option.description)
            )
          );

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        const submitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${ALTERNATIVE_LENS_SUBMIT_PREFIX}${interaction.message.id}`)
            .setLabel('Submit')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
          content: 'Pick a perspective to reframe this response. Selecting "Custom Lens" will prompt for details.',
          components: [selectRow, submitRow],
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
      } catch (error) {
        logger.error('Failed to initialise alternative lens session:', error);
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: 'Something went wrong while starting the alternative lens flow. Please try again later.',
            flags: [1 << 6] // [1 << 6] = EPHEMERAL
          });
        } else {
          await interaction.reply({
            content: 'Something went wrong while starting the alternative lens flow. Please try again later.',
            flags: [1 << 6] // [1 << 6] = EPHEMERAL
          });
        }
      }

      return;
    }

    if (customId.startsWith(ALTERNATIVE_LENS_SUBMIT_PREFIX)) {
      const messageId = customId.slice(ALTERNATIVE_LENS_SUBMIT_PREFIX.length);
      const sessionKey = buildAlternativeLensSessionKey(interaction.user.id, messageId);
      const session = getAlternativeLensSession(sessionKey);

      if (!session) {
        await interaction.reply({
          content: 'That alternative lens session expired. Click **Alternative Lens** again to start over.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      if (!session.context.messageText) {
        clearAlternativeLensSession(sessionKey);
        await interaction.reply({
          content: 'The original response is no longer available for reinterpretation. Start a new alternative lens request.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const lens = buildLensPayload(session);
      if (!lens) {
        await interaction.reply({
          content: 'Select a lens first. If you choose Custom Lens, provide a description before submitting.',
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        logger.warn('Failed to defer alternative lens reply:', error);
        if (!interaction.deferred && !interaction.replied) {
          try {
            await interaction.reply({
              content: 'I could not begin generating that alternative lens. Please try again.',
              flags: [1 << 6] // [1 << 6] = EPHEMERAL
            });
          } catch (replyError) {
            logger.warn('Failed to reply after defer failure:', replyError);
          }
        }
        return;
      }

      try {
        const generated = await generateAlternativeLensMessage(
          openaiService,
          {
            messageText: session.context.messageText,
            metadata: session.context.metadata
          },
          lens
        );

        const channel = interaction.channel;
        if (!channel || !channel.isSendable()) {
          await interaction.editReply({
            content: 'I could not post the alternative lens response in this channel.'
          });
          return;
        }

        const combinedContent = `**Alternative Lens: ${lens.label}**\n\n${generated.trim()}`;
        const chunks = splitContentForDiscord(combinedContent);
        const replyReference = {
          messageReference: session.context.messageId,
          failIfNotExists: false
        };
        const deliverableChunks = chunks.length > 0 ? chunks : ['(no alternative lens content produced)'];

        let isFirstChunk = true;
        for (const chunk of deliverableChunks) {
          const safeContent = chunk.length > 0 ? chunk : '\u200B';
          await channel.send({
            content: safeContent,
            ...(isFirstChunk ? { reply: replyReference } : {})
          });
          isFirstChunk = false;
        }

        await interaction.editReply({ content: 'Posted the alternative lens response.' });
      } catch (error) {
        logger.error('Failed to generate alternative lens response:', error);
        await interaction.editReply({
          content: 'I could not generate that alternative lens. Please try again later.'
        });
      } finally {
        clearAlternativeLensSession(sessionKey);
      }

      return;
    }

    // Variation buttons all share the same prefix, so handle the specific
    // actions (generate, reset, cancel, prompt modal) before the generic
    // configurator entry point to avoid mis-routing follow-up clicks.
    if (customId.startsWith(IMAGE_VARIATION_GENERATE_CUSTOM_ID_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_GENERATE_CUSTOM_ID_PREFIX.length);
      const session = getVariationSession(interaction.user.id, responseId);
      if (!session) {
        await interaction.reply({ 
          content: '⚠️ That variation configurator expired. Press the variation button again.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const cooldownRemaining = session.cooldownUntil ? Math.max(0, Math.ceil((session.cooldownUntil - Date.now()) / 1000)) : 0;
      if (cooldownRemaining > 0) {
        await interaction.reply({ 
          content: `⚠️ Please wait ${formatRetryCountdown(cooldownRemaining)} before generating another variation.`, 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const developerBypass = interaction.user.id === process.env.DEVELOPER_USER_ID;
      let tokenSpend = null as ReturnType<typeof consumeImageTokens> | null;

      // Spend tokens only when the user is not in developer bypass mode. This keeps
      // chained variations consistent with the slash-command flow.
      if (!developerBypass) {
        const spendResult = consumeImageTokens(interaction.user.id, session.quality, session.imageModel);
        if (!spendResult.allowed) {
          const statusMessage = buildVariationStatusMessage(
            interaction.user.id,
            describeTokenAvailability(session.quality, spendResult, session.imageModel)
          );

          const updatedSession = spendResult.remainingTokens === 0 && spendResult.refreshInSeconds > 0
            ? applyVariationCooldown(interaction.user.id, responseId, spendResult.refreshInSeconds) ?? session
            : resetVariationCooldown(interaction.user.id, responseId) ?? session;

          if (session.messageUpdater) {
            try {
              await session.messageUpdater(
                buildVariationConfiguratorView(updatedSession, { statusMessage })
              );
            } catch (error) {
              logger.warn('Failed to refresh variation configurator after token denial:', error);
            }
          }

          await interaction.reply({ 
            content: statusMessage, 
            flags: [1 << 6] // [1 << 6] = EPHEMERAL
          });
          return;
        }

        tokenSpend = spendResult;
      }

      try {
        if (session.messageUpdater) {
          await session.messageUpdater({ content: '⏳ Generating variation…', embeds: [], components: [] });
        }
      } catch (error) {
        logger.warn('Failed to update variation configurator before generation:', error);
      }

      await interaction.deferReply();

      try {
        const runContext = {
          prompt: session.prompt,
          originalPrompt: session.originalPrompt,
          refinedPrompt: session.refinedPrompt,
          textModel: session.textModel,
          imageModel: session.imageModel,
          size: session.size,
          aspectRatio: session.aspectRatio,
          aspectRatioLabel: session.aspectRatioLabel,
          quality: session.quality,
          background: session.background,
          style: session.style,
          allowPromptAdjustment: session.allowPromptAdjustment
        };

        const result = await runImageGenerationSession(interaction, runContext, responseId);

        if (!result.success && tokenSpend) {
          refundImageTokens(interaction.user.id, tokenSpend.cost);
        }
      } catch (error) {
        logger.error('Unexpected error while generating variation:', error);
        if (tokenSpend) {
          refundImageTokens(interaction.user.id, tokenSpend.cost);
        }
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '⚠️ Something went wrong while generating that variation.', 
            flags: [1 << 6] // [1 << 6] = EPHEMERAL
          });
        }
      } finally {
        disposeVariationSession(`${interaction.user.id}:${responseId}`);
      }

      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_RESET_PROMPT_CUSTOM_ID_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_RESET_PROMPT_CUSTOM_ID_PREFIX.length);
      const session = updateVariationSession(interaction.user.id, responseId, current => {
        current.prompt = current.originalPrompt;
        current.refinedPrompt = current.originalPrompt;
      });

      if (!session) {
        await interaction.reply({ 
          content: '⚠️ That variation configurator expired. Press the variation button again.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const refreshed = resetVariationCooldown(interaction.user.id, responseId) ?? session;
      await interaction.update(
        buildVariationConfiguratorView(refreshed, {
          statusMessage: buildVariationStatusMessage(interaction.user.id)
        })
      );
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_CANCEL_CUSTOM_ID_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_CANCEL_CUSTOM_ID_PREFIX.length);
      disposeVariationSession(`${interaction.user.id}:${responseId}`);
      await interaction.update({ content: '❎ Variation cancelled.', embeds: [], components: [] });
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX)) {
      const responseId = customId.slice(IMAGE_VARIATION_PROMPT_MODAL_ID_PREFIX.length);
      const session = getVariationSession(interaction.user.id, responseId);
      if (!session) {
        await interaction.reply({ 
          content: '⚠️ That variation configurator expired. Press the variation button again.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      await interaction.showModal(buildPromptModal(responseId, session.prompt));
      return;
    }

    if (customId.startsWith(IMAGE_VARIATION_CUSTOM_ID_PREFIX)) {
      const followUpResponseId = customId.slice(IMAGE_VARIATION_CUSTOM_ID_PREFIX.length);
      if (!followUpResponseId) {
        await interaction.reply({ 
          content: '⚠️ I could not determine which image to vary.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
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
        await interaction.reply({ 
          content: '⚠️ Sorry, I can no longer create a variation for that image. Please run /image again.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      cachedContext.originalPrompt = cachedContext.originalPrompt ?? cachedContext.prompt;
      cachedContext.refinedPrompt = cachedContext.refinedPrompt ?? null;
      saveFollowUpContext(followUpResponseId, cachedContext);

      const session = initialiseVariationSession(interaction.user.id, followUpResponseId, cachedContext);

      await interaction.deferReply({ ephemeral: true });
      const view = buildVariationConfiguratorView(session, {
        statusMessage: buildVariationStatusMessage(interaction.user.id)
      });
      await interaction.editReply(view);
      const storedSession = setVariationSessionUpdater(interaction.user.id, followUpResponseId, options => interaction.editReply(options));
      if (!storedSession) {
        logger.warn('Failed to store variation configurator updater: session missing after initialisation.');
      }

      return;
    }

    if (customId === 'report_issue') {
      logger.info(`Report Issue button clicked by user: ${interaction.user.id} on message: ${interaction.message.id} (${interaction.message.url})`);
      await interaction.reply({
        content: "This feature isn't active yet. To report ethical or security issues, please follow the instructions in [SECURITY.md](https://github.com/arete-org/arete/blob/main/SECURITY.md).",
        flags: [1 << 6] // [1 << 6] = EPHEMERAL
      });
      return;
    }

    // Other button handlers fall through to the retry logic below.
    if (customId.startsWith(IMAGE_RETRY_CUSTOM_ID_PREFIX)) {
      const retryKey = interaction.customId.slice(IMAGE_RETRY_CUSTOM_ID_PREFIX.length);
      if (!retryKey) {
        await interaction.reply({ 
          content: '⚠️ I could not find that image request to retry.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const cachedContext = readFollowUpContext(retryKey);
      if (!cachedContext) {
        await interaction.reply({ 
          content: '⚠️ Sorry, that retry expired. Please ask me to generate a new image.', 
          flags: [1 << 6] // [1 << 6] = EPHEMERAL
        });
        return;
      }

      const isDeveloper = interaction.user.id === process.env.DEVELOPER_USER_ID;
      let retrySpend = null as ReturnType<typeof consumeImageTokens> | null;
      if (!isDeveloper) {
        const spendResult = consumeImageTokens(interaction.user.id, cachedContext.quality, cachedContext.imageModel);
        if (!spendResult.allowed) {
          const message = `${describeTokenAvailability(cachedContext.quality, spendResult, cachedContext.imageModel)}\n\n${buildTokenSummaryLine(interaction.user.id)}`;
          const countdown = spendResult.refreshInSeconds;
          const retryRow = countdown > 0 ? createRetryButtonRow(retryKey, formatRetryCountdown(countdown)) : undefined;
          try {
            await interaction.update({ content: message, components: retryRow ? [retryRow] : [] });
          } catch {
            await interaction.reply({ 
              content: message, 
              flags: [1 << 6], // [1 << 6] = EPHEMERAL
              components: retryRow ? [retryRow] : []
             });
          }
          return;
        }

        retrySpend = spendResult;
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
        if (retrySpend) {
          refundImageTokens(interaction.user.id, retrySpend.cost);
        }
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
