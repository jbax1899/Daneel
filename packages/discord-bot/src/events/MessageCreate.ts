/**
 * @file MessageCreate.ts
 * @description Handles the 'messageCreate' event from Discord.js, specifically for processing
 * messages that mention the bot or are replies to the bot.
 */

import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';
import { Planner } from '../utils/prompting/Planner.js';
import { config } from '../utils/env.js';
import { ResponseHandler } from '../utils/response/ResponseHandler.js';

/**
 * Dependencies required for the MentionBotEvent
 * @interface Dependencies
 * @property {Object} openai - Configuration for the OpenAI service
 * @property {string} openai.apiKey - The API key for OpenAI
 * @property {OpenAIService} openaiService - The OpenAI service instance
 */
interface Dependencies {
  openai: {
    apiKey: string;
  };
  openaiService: OpenAIService;
}

/**
 * Handles messages that mention the bot or are replies to the bot.
 * Extends the base Event class to process messages and generate responses.
 * @class MentionBotEvent
 * @extends {Event}
 */
export class MessageCreate extends Event {
  public readonly name = 'messageCreate' as const;                                                      // The Discord.js event name this handler is registered for
  public readonly once = false;                                                                         // Whether the event should only be handled once (false for message events)
  private readonly messageProcessor: MessageProcessor;                                                  // The message processor that handles the actual message processing logic
  private readonly CATCHUP_AFTER_MESSAGES = config.catchUp.afterMessages;                               // Configurable catch-up threshold
  private readonly CATCHUP_IF_MENTIONED_AFTER_MESSAGES = config.catchUp.ifMentionedAfterMessages;       // Configurable catch-up threshold when mentioned in plaintext
  private readonly channelMessageCounters = new Map<string, { count: number; lastUpdated: number }>();  // Tracks message counts per channel for catch-up logic
  private readonly STALE_COUNTER_TTL_MS = config.catchUp.staleCounterTtlMs;                             // Configurable counter expiry
  private readonly ALLOW_THREAD_RESPONSES = config.visibility.allowThreadResponses;                     // Whether responding in threads is allowed
  private readonly allowedThreadIds = new Set(config.visibility.allowedThreadIds);                      // Threads where Daneel is allowed to engage
  private readonly botConversationStates = new Map<string, BotConversationState>();                     // Tracks back-and-forth exchanges with other bots
  private readonly BOT_CONVERSATION_TTL_MS = config.botInteraction.conversationTtlMs;                   // How long to remember bot conversations before resetting
  private readonly BOT_INTERACTION_COOLDOWN_MS = Math.max(config.botInteraction.cooldownMs, 1000);      // Cooldown applied after we stop engaging

  /**
   * Creates an instance of MentionBotEvent
   * @param {Dependencies} dependencies - Required dependencies including OpenAI configuration
   */
  constructor(dependencies: Dependencies) {
    super({ name: 'messageCreate', once: false });

    if (!dependencies?.openaiService) {
      throw new Error('MessageCreate event requires an OpenAI service dependency');
    }

    this.messageProcessor = new MessageProcessor({
      openaiService: dependencies.openaiService,
      planner: new Planner(dependencies.openaiService)
    });
  }

  /**
   * Main execution method called when a message is created.
   * Processes the message if it's not ignored.
   * @param {Message} message - The Discord message that was created
   * @returns {Promise<void>}
   */
  public async execute(message: Message): Promise<void> {
    // Check if the message is in a thread, and if so, if it's in an allowed thread
    if (this.disallowedThread(message)) {
      return;
    }

    this.cleanupStaleCounters();
    this.cleanupStaleBotConversations();
    const channelKey = this.getChannelCounterKey(message);

    // If we just posted a message, reset the counter, and ignore self
    if (message.author.id === message.client.user!.id) {
      this.resetCounter(channelKey);
      this.markBotMessageSent(channelKey);
      logger.debug(`Reset message count for ${channelKey}: 0`);
      return;
    }

    // If the author is not a bot, clear any bot-to-bot conversation tracking for this channel
    if (!message.author.bot) {
      this.botConversationStates.delete(channelKey);
    }

    // Guard against endless loops with other bots before delegating to the planner/response pipeline
    if (await this.shouldSuppressBotResponse(message, channelKey)) {
      return;
    }

    // New message: Increment the counter for this channel
    const messageCount = this.incrementCounter(channelKey);
    logger.debug(`Last message count for ${channelKey}: ${messageCount}`);

    try {
      // Do not ignore if the message mentions the bot with @Daneel, or is a direct Discord reply
      if (this.isBotMentioned(message)) {
        logger.debug(`Responding to mention in message ID: ${message.id}`);
        await this.messageProcessor.processMessage(message, true, `Daneel was mentioned with a direct ping`);
      }
      else if (this.isReplyToBot(message)) {
        logger.debug(`Responding to reply in message ID: ${message.id}`);
        await this.messageProcessor.processMessage(message, true, `Daneel was replied to with a direct reply`);
      }
      // If we are within the catchup threshold, catch up
      else if (
        (messageCount >= this.CATCHUP_AFTER_MESSAGES) // if we are within the -regular- catchup threshold, catch up
        || (messageCount >= this.CATCHUP_IF_MENTIONED_AFTER_MESSAGES && message.content.toLowerCase().includes(message.client.user!.username.toLowerCase())) // if we were mentioned by name (plaintext), and are within the -mention- catchup threshold, catch up
      ) {
        logger.debug(`Catching up in ${channelKey} to message ID: ${message.id}`);
        this.resetCounter(channelKey);
        await this.messageProcessor.processMessage(message, false, 'enough messages have passed since Daneel last replied'); // Do not direct-reply to anyone when catching up
      }
    } catch (error) {
      await this.handleError(error, message);
    }
  }

  /**
   * Checks if the bot is mentioned in the message.
   * @private
   * @param {Message} message - The message to check
   * @returns {boolean} True if the bot is mentioned, false otherwise
   */
  private isBotMentioned(message: Message): boolean {
    return message.mentions.users.has(message.client.user!.id); // Discord converts @Daneel to the bot's ID
  }

  /**
   * Checks if the message is a reply to the bot.
   * @private
   * @param {Message} message - The message to check
   * @returns {boolean} True if the message is a reply to the bot, false otherwise
   */
  private isReplyToBot(message: Message): boolean {
    if (!message.reference?.messageId) return false;

    const isSameChannel = message.reference.guildId === message.guildId &&
      message.reference.channelId === message.channelId;
    const isReplyingToBot = message.mentions.repliedUser?.id === message.client.user!.id;

    return isSameChannel && isReplyingToBot;
  }

  /**
   * Checks if 
   * A. the message is in a thread, 
   * B. if thread responses are disallowed, and 
   * C. if the thread is not in the allowlist. 
   * @private
   * @param {Message} message - The message to check
   * @returns {boolean} True if the message is in a disallowed thread, false otherwise
   */
  private disallowedThread(message: Message): boolean {
    if (!message.channel.isThread()) {
      return false; // not a thread
    }

    if (this.ALLOW_THREAD_RESPONSES) {
      return false; // globally allowed
    }

    // globally disallowed; only allow threads present in the allowlist
    return !this.allowedThreadIds.has(message.channel.id);
  }

  private getChannelCounterKey(message: Message): string {
    return `${message.guildId ?? 'DM'}:${message.channelId}`;
  }

  private resetCounter(channelKey: string): void {
    this.channelMessageCounters.delete(channelKey);
  }

  private incrementCounter(channelKey: string): number {
    const existing = this.channelMessageCounters.get(channelKey);
    const count = (existing?.count ?? 0) + 1;
    this.channelMessageCounters.set(channelKey, { count, lastUpdated: Date.now() });
    return count;
  }

  private cleanupStaleCounters(): void {
    const now = Date.now();
    for (const [key, value] of this.channelMessageCounters.entries()) {
      if (now - value.lastUpdated > this.STALE_COUNTER_TTL_MS) {
        this.channelMessageCounters.delete(key);
      }
    }
  }

  /**
   * Handles errors that occur during message processing.
   * Logs the error and attempts to notify the user.
   * @private
   * @param {unknown} error - The error that occurred
   * @param {Message} message - The message that was being processed when the error occurred
   * @returns {Promise<void>}
   */
  private async handleError(error: unknown, message: Message): Promise<void> {
    logger.error('Error in MentionBotEvent:', error);

    // Attempt to send an error reply to the user
    try {
      const response = 'Sorry, I encountered an error while processing your message.';
      if (message.channel.isTextBased()) {
        await message.reply(response);
      }
    } catch (replyError) {
      logger.error('Failed to send error reply:', replyError);
    }
  }

  /**
   * Determines whether we should refuse to respond to another bot in order to avoid
   * two automated agents getting stuck in an infinite loop. The method keeps lightweight
   * state per channel so that we can cap the number of back-and-forth exchanges while
   * still allowing occasional hand-offs between bots.
   */
  private async shouldSuppressBotResponse(message: Message, channelKey: string): Promise<boolean> {
    if (!message.author.bot || message.author.id === message.client.user!.id) {
      return false;
    }

    const now = Date.now();
    let state = this.botConversationStates.get(channelKey);

    if (state && (now - state.lastUpdated > this.BOT_CONVERSATION_TTL_MS || state.botId !== message.author.id)) {
      // Expire stale state or reset when a different bot joins the conversation.
      state = undefined;
      this.botConversationStates.delete(channelKey);
    }

    if (!state) {
      // First message we have seen from this bot recently – record it and proceed normally.
      state = {
        botId: message.author.id,
        exchanges: 0,
        lastDirection: 'other',
        lastUpdated: now
      };
      this.botConversationStates.set(channelKey, state);
      return false;
    }

    if (state.blockedUntil) {
      if (now < state.blockedUntil) {
        state.lastUpdated = now;
        state.lastDirection = 'other';
        await this.reactToSuppressedBotMessage(message);
        logger.debug(`Suppressed response to bot ${message.author.id} in ${channelKey} (cooldown active).`);
        return true;
      }

      // Cooldown elapsed, allow a fresh set of exchanges.
      delete state.blockedUntil;
      state.exchanges = 0;
    }

    if (state.lastDirection === 'self') {
      state.exchanges += 1;
    }

    state.lastDirection = 'other';
    state.lastUpdated = now;

    if (state.exchanges >= config.botInteraction.maxBackAndForth) {
      state.blockedUntil = now + this.BOT_INTERACTION_COOLDOWN_MS;
      await this.reactToSuppressedBotMessage(message);
      logger.info(`Reached bot conversation limit with ${message.author.id} in ${channelKey}; suppressing replies.`);
      return true;
    }

    return false;
  }

  /**
   * Adds the configured emoji reaction (when enabled) to acknowledge the other bot without
   * sending a full reply. Errors are swallowed so that a failure to react does not break
   * the main message handling pipeline.
   */
  private async reactToSuppressedBotMessage(message: Message): Promise<void> {
    if (config.botInteraction.afterLimitAction !== 'react') {
      return;
    }

    try {
      if (!message.channel.isTextBased()) {
        // Some message types (e.g., stage channels) do not allow reactions; skip gracefully.
        return;
      }

      const responseHandler = new ResponseHandler(message, message.channel, message.author);
      await responseHandler.addReaction(config.botInteraction.reactionEmoji);
    } catch (error) {
      logger.warn('Failed to add reaction while suppressing bot conversation:', error);
    }
  }

  /**
   * Marks that Daneel has spoken in the tracked channel so that the next bot message counts
   * as a new exchange when calculating the back-and-forth limit. The existing exchange tally
   * is preserved so that we continue from the previous count instead of resetting it to zero
   * each time Daneel chooses to re-engage.
   */
  private markBotMessageSent(channelKey: string): void {
    const state = this.botConversationStates.get(channelKey);
    if (state) {
      state.lastDirection = 'self';
      state.lastUpdated = Date.now();
      // Clear any existing cooldown after we choose to re-engage manually (e.g., a human unblocks the conversation).
      delete state.blockedUntil;
    }
  }

  /**
   * Periodically purge stale bot conversation tracking entries to prevent unbounded memory growth.
   */
  private cleanupStaleBotConversations(): void {
    const now = Date.now();
    for (const [key, value] of this.botConversationStates.entries()) {
      if (now - value.lastUpdated > this.BOT_CONVERSATION_TTL_MS) {
        this.botConversationStates.delete(key);
      }
    }
  }
}

/**
 * Lightweight tracking structure for back-and-forth exchanges with a specific bot in a channel.
 */
type BotConversationState = {
  botId: string;
  exchanges: number;
  lastDirection: 'self' | 'other';
  lastUpdated: number;
  blockedUntil?: number;
};
