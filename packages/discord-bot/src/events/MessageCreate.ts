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
  public readonly name = 'messageCreate' as const;          // The Discord.js event name this handler is registered for
  public readonly once = false;                             // Whether the event should only be handled once (false for message events)
  private readonly messageProcessor: MessageProcessor;      // The message processor that handles the actual message processing logic
  private readonly CATCHUP_AFTER_MESSAGES = 10;             // After X messages, do a catchup
  private readonly CATCHUP_IF_MENTIONED_AFTER_MESSAGES = 5; // After X messages, if mentioned, do a catchup
  private readonly channelMessageCounters = new Map<string, { count: number; lastUpdated: number }>(); // Tracks message counts per channel for catch-up logic
  private readonly STALE_COUNTER_TTL_MS = 1000 * 60 * 60;   // Counters expire after an hour of inactivity
  private readonly ALLOWED_THREAD_IDS = ['1407811416244617388']; //TODO: hoist this to config

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
    const channelKey = this.getChannelCounterKey(message);

    // If we just posted a message, reset the counter, and ignore self
    if (message.author.id === message.client.user!.id) {
      this.resetCounter(channelKey);
      logger.debug(`Reset message count for ${channelKey}: 0`);
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
   * Checks if A. the message is in a thread, and B. the thread is in a disallowed thread.
   * @private
   * @param {Message} message - The message to check
   * @returns {boolean} True if the message is in a disallowed thread, false otherwise
   */
  private disallowedThread(message: Message): boolean {
    return message.channel.isThread() && !this.ALLOWED_THREAD_IDS.includes(message.channel.id);
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
}
