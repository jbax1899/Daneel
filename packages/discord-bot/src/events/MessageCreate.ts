/**
 * @arete-module: MessageCreate
 * @arete-risk: high
 * @arete-ethics: critical
 * @arete-scope: core
 *
 * @description
 * Handles the 'messageCreate' event from Discord.js, processing messages that mention the bot or are replies. Manages engagement logic, catch-up thresholds, and bot-to-bot conversation limits.
 *
 * @impact
 * Risk: Message processing failures can break user interactions or create inappropriate responses. Manages mention detection, catch-up logic, and bot conversation tracking.
 * Ethics: Controls user interaction frequency and AI response behavior. Governs engagement thresholds, thread restrictions, and bot-to-bot conversation limits to prevent spam and ensure respectful interaction.
 */

import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';
import { CatchupFilter } from '../utils/CatchupFilter.js';
import { Planner } from '../utils/prompting/Planner.js';
import { config } from '../utils/env.js';
import { ResponseHandler } from '../utils/response/ResponseHandler.js';
import { ChannelContextManager } from '../state/ChannelContextManager.js';

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
 * Structure to track the state of a back-and-forth conversation with a specific bot within a channel.
 */
type BotConversationState = {
  botId: string;
  exchanges: number;
  lastDirection: 'self' | 'other';
  lastUpdated: number;
  blockedUntil?: number;
};

/**
 * Represents the central handler for Discord messages that qualify for engagement by the bot.
 *
 * Handles engagement eligibility for bot mentions, replies, and related triggers.
 * - Detects when the bot should process a message (mentions, replies, etc).
 * - Applies operational and ethical controls to limit replies, pacing, and prevent bot-to-bot loops.
 * - Uses catch-up logic and thresholds to avoid unnecessary LLM/planner calls during message floods or high throughput.
 * - Tracks bot conversations and applies cooldowns to prevent spam or feedback cycles.
 * - Manages channel-scoped context (if enabled) for memory, metrics, and engagement quality.
 * - Integrates with injected services (LLMs, planners, response handlers) for response generation.
 * - Adds observability (logging, metrics, self-auditing) for failure, risk, and diagnostic insight.
 *
 * Extends `Event` with layered logic for engagement, context, mention/intent detection,
 * ethical limits, catch-up gating, and coordinated response.
 *
 * @class MessageCreate
 * @extends {Event}
 */
export class MessageCreate extends Event {
  public readonly name = 'messageCreate' as const;                                                      // The Discord.js event name this handler is registered for
  public readonly once = false;                                                                         // Whether the event should only be handled once (false for message events)
  private readonly messageProcessor: MessageProcessor;                                                  // The message processor that handles the actual message processing logic
  private readonly catchupFilter: CatchupFilter;                                                        // Heuristic filter to short-circuit unnecessary planner calls during catchup
  private readonly CATCHUP_AFTER_MESSAGES = config.catchUp.afterMessages;                               // Configurable catch-up threshold
  private readonly CATCHUP_IF_MENTIONED_AFTER_MESSAGES = config.catchUp.ifMentionedAfterMessages;       // Configurable catch-up threshold when mentioned in plaintext
  private readonly channelMessageCounters = new Map<string, { count: number; lastUpdated: number }>();  // Tracks message counts per channel for catch-up logic
  private readonly STALE_COUNTER_TTL_MS = config.catchUp.staleCounterTtlMs;                             // Configurable counter expiry
  private readonly ALLOW_THREAD_RESPONSES = config.visibility.allowThreadResponses;                     // Whether responding in threads is allowed
  private readonly allowedThreadIds = new Set(config.visibility.allowedThreadIds);                      // Threads where the bot is allowed to engage
  private readonly botConversationStates = new Map<string, BotConversationState>();                     // Tracks back-and-forth exchanges with other bots
  private readonly BOT_CONVERSATION_TTL_MS = config.botInteraction.conversationTtlMs;                   // How long to remember bot conversations before resetting
  private readonly BOT_INTERACTION_COOLDOWN_MS = Math.max(config.botInteraction.cooldownMs, 1000);      // Cooldown applied after we stop engaging
  private readonly contextManager: ChannelContextManager | null;
  private readonly CONTEXT_STATE_LOG_THROTTLE_MS = 15_000;                                              // Throttle context_state logs per channel (ms)
  private readonly CONTEXT_STATE_LOG_RETENTION_MS = this.CONTEXT_STATE_LOG_THROTTLE_MS * 10;            // Maximum age before pruning context_state entries
  private readonly contextStateLogTimestamps = new Map<string, number>();                               // Track last context_state log per channel

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
    this.catchupFilter = new CatchupFilter(dependencies.openaiService);

    if (config.contextManager.enabled) {
      this.contextManager = new ChannelContextManager({
        enabled: true,
        maxMessagesPerChannel: config.contextManager.maxMessagesPerChannel,
        messageRetentionMs: config.contextManager.messageRetentionMs,
        evictionIntervalMs: config.contextManager.evictionIntervalMs
      });
      logger.info('ChannelContextManager enabled');
    } else {
      this.contextManager = null;
      logger.debug('ChannelContextManager disabled');
    }

    logger.info(
      `MessageCreate initialized with context manager: ${this.contextManager ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Main execution method called when a message is created.
   * Processes the message if it's not ignored.
   * @param {Message} message - The Discord message that was created
   * @returns {Promise<void>}
   */
  public async execute(message: Message): Promise<void> {
    // Check if the message is in a disallowed thread - if so, ignore it
    if (this.disallowedThread(message)) {
      return;
    }

    this.cleanupStaleCounters();
    this.cleanupStaleBotConversations();
    this.cleanupStaleContextStateLogs();
    const channelKey = this.getChannelCounterKey(message);

    // Record message in context manager if enabled
    if (this.contextManager) {
      try {
        this.contextManager.recordMessage(channelKey, message);
      } catch (error) {
        // Fail open - log but don't break message processing
        logger.error(`Context manager failed to record message: ${(error as Error)?.message ?? error}`);
      }
    }

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

    // Emit context state log if manager enabled
    if (this.contextManager) {
      try {
        const now = Date.now();
        const lastLoggedAt = this.contextStateLogTimestamps.get(channelKey) ?? 0;
        if (now - lastLoggedAt >= this.CONTEXT_STATE_LOG_THROTTLE_MS) {
          const metrics = this.contextManager.getMetrics(channelKey);
          if (metrics) {
            this.contextStateLogTimestamps.set(channelKey, now);
            logger.debug(
              JSON.stringify({
                event: 'context_state',
                channelId: channelKey,
                rollingMessageCount: this.contextManager.getRecentMessages(channelKey).length,
                totalMessages: metrics.totalMessages,
                flags: metrics.flags
              })
            );
          }
        }
      } catch (error) {
        // Fail open - log but don't break message processing
        logger.debug(`Context manager state logging failed: ${(error as Error)?.message ?? error}`);
      }
    }

    /**
     * Process the message if it qualifies for engagement by the bot.
     * - If the message is a mention of the bot, process it.
     * - If the message is a reply to the bot, process it.
     * - If we are within the catchup threshold, catch up.
     * - If the message is not a mention or reply, and we are not within the catchup threshold, do nothing.
     */
    try {
      // Do not ignore if the message mentions the bot with @, or is a direct Discord reply
      // If the message is a direct mention of the bot, process it.
      if (this.isBotMentioned(message)) {
        logger.debug(`Responding to mention in message ID ${message.id} from ${message.author.id} in channel ${message.channel.id} (${message.channel.type})`);
        await this.messageProcessor.processMessage(message, true, `Mentioned with a direct ping`);
      }
      // If the message is a direct reply to the bot, process it.
      else if (this.isReplyToBot(message)) {
        logger.debug(`Responding to reply with message ID ${message.id} from ${message.author.id} in channel ${message.channel.id} (${message.channel.type})`);
        await this.messageProcessor.processMessage(message, true, `Replied to with a direct reply`);
      }
      // If we are within the catchup threshold, catch up.
      else if (
        (messageCount >= this.CATCHUP_AFTER_MESSAGES) // if we are within the -regular- catchup threshold, catch up
        || (messageCount >= this.CATCHUP_IF_MENTIONED_AFTER_MESSAGES && message.content.toLowerCase().includes(message.client.user!.username.toLowerCase())) // if we were mentioned by name (plaintext), and are within the -mention- catchup threshold, catch up
      ) {
        logger.debug(`Catching up in ${channelKey} to message ID ${message.id} from ${message.author.id} in channel ${message.channel.id} (${message.channel.type})`);
        this.resetCounter(channelKey); // Reset the counter for this channel

        if (!message.channel.isTextBased()) {
          logger.debug(`Catchup filter bypassed for ${channelKey}; channel not text-based.`);
          return;
        }

        /**
         * Apply the catchup filter to the message.
         * - If the filter decides to skip the planner, return.
         * - If the filter decides to proceed to the planner, process the message.
         */
        try {
          const recentMessagesCollection = await message.channel.messages.fetch({
            limit: this.catchupFilter.RECENT_MESSAGE_WINDOW,
            before: message.id
          });
          const recentMessages = Array.from(recentMessagesCollection.values()).sort(
            (first, second) => first.createdTimestamp - second.createdTimestamp
          );
          const filterDecision = await this.catchupFilter.shouldSkipPlanner(message, recentMessages, channelKey);

          if (filterDecision.skip) {
            logger.debug(`Catchup filter skipped planner for ${channelKey}: ${filterDecision.reason}`);
            return;
          }

          logger.debug(`Catchup filter passed for ${channelKey}, proceeding to planner`);
        } catch (filterError) {
          logger.error(`Catchup filter encountered an error for ${channelKey}: ${(filterError as Error)?.message ?? filterError}`);
        }

        // Process the message using the message processor.
        // We mark directReply as false to avoid bothering chatters.
        // As this is an automatic task, the bot's voice may not be needed. We pass that in the trigger message to help decide how to handle the response.
        await this.messageProcessor.processMessage(message, false, `Enough messages have passed since you last replied - catching up. As this is an automatic task, your voice may not be needed.`);
      }
    } catch (error) {
      await this.handleError(error, message);
    }
  }

  /**
   * Checks if the bot is mentioned in the message.
   * @param {Message} message - The message to check
   * @returns {boolean} True if the bot is mentioned, false otherwise
   */
  private isBotMentioned(message: Message): boolean {
    return message.mentions.users.has(message.client.user!.id); // Discord converts @botname to the bot's ID
  }

  /**
   * Checks if the message is a reply to the bot.
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

  /**
   * Returns a string key that uniquely identifies a channel within a guild,
   * or returns "DM:channelId" for direct messages.
   * Used for tracking message counters per channel.
   * @param {Message} message - The Discord message object
   * @returns {string} The generated channel counter key
   */
  private getChannelCounterKey(message: Message): string {
    return `${message.guildId ?? 'DM'}:${message.channelId}`;
  }

  /**
   * Resets the message counter for a specific channel.
   * @param {string} channelKey - The key identifying the channel whose message counter should be reset
   */
  private resetCounter(channelKey: string): void {
    this.channelMessageCounters.delete(channelKey);
  }

  /**
   * Increments and returns the message count for a given channel key.
   * Used to track the number of messages sent in a channel or thread for catch-up logic.
   * @param {string} channelKey - Composite key of the channel (e.g., "guildId:channelId" or "DM:channelId")
   * @returns {number} The new message count for the channel after incrementing
   */
  private incrementCounter(channelKey: string): number {
    const existing = this.channelMessageCounters.get(channelKey);
    const count = (existing?.count ?? 0) + 1;
    this.channelMessageCounters.set(channelKey, { count, lastUpdated: Date.now() });
    return count;
  }

  /**
   * Cleans up stale message counters for all channels.
   * Removes any entry from channelMessageCounters where the lastUpdated
   * timestamp exceeds the configured stale counter TTL.
   * Should be called periodically to prevent unbounded growth of the map.
   */
  private cleanupStaleCounters(): void {
    const now = Date.now();
    for (const [key, value] of this.channelMessageCounters.entries()) {
      if (now - value.lastUpdated > this.STALE_COUNTER_TTL_MS) {
        this.channelMessageCounters.delete(key);
      }
    }
  }

  /**
   * Removes entries from the contextStateLogTimestamps map if they are older than
   * CONTEXT_STATE_LOG_RETENTION_MS. This is used to limit growth of the per-channel
   * context state log tracking.
   * Should be invoked periodically to maintain the map size and discard obsolete log times.
   */
  private cleanupStaleContextStateLogs(): void {
    const now = Date.now();
    for (const [key, lastLoggedAt] of this.contextStateLogTimestamps.entries()) {
      if (now - lastLoggedAt > this.CONTEXT_STATE_LOG_RETENTION_MS) {
        this.contextStateLogTimestamps.delete(key);
      }
    }
  }

  /**
   * Handles errors that occur during message processing.
   * Logs the error and attempts to notify the user.
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
   * Marks that the bot has spoken in the tracked channel so that the next bot message counts
   * as a new exchange when calculating the back-and-forth limit. The existing exchange tally
   * is preserved so that we continue from the previous count instead of resetting it to zero
   * each time the bot chooses to re-engage.
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
