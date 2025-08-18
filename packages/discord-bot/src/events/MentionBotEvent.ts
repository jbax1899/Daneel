/**
 * @file MentionBotEvent.ts
 * @description Handles the 'messageCreate' event from Discord.js, specifically for processing
 * messages that mention the bot or are replies to the bot.
 */

import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { PromptBuilder } from '../utils/prompting/PromptBuilder.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';

/**
 * Dependencies required for the MentionBotEvent
 * @interface Dependencies
 * @property {Object} openai - Configuration for the OpenAI service
 * @property {string} openai.apiKey - The API key for OpenAI
 */
interface Dependencies {
  openai: {
    apiKey: string;
  };
}

/**
 * Handles messages that mention the bot or are replies to the bot.
 * Extends the base Event class to process messages and generate responses.
 * @class MentionBotEvent
 * @extends {Event}
 */
export class MentionBotEvent extends Event {
  /** The Discord.js event name this handler is registered for */
  public readonly name = 'messageCreate' as const;
  
  /** Whether the event should only be handled once (false for message events) */
  public readonly once = false;
  
  /** The message processor that handles the actual message processing logic */
  private readonly messageProcessor: MessageProcessor;

  /**
   * Creates an instance of MentionBotEvent
   * @param {Dependencies} dependencies - Required dependencies including OpenAI configuration
   */
  constructor(dependencies: Dependencies) {
    super({ name: 'messageCreate', once: false });
    this.messageProcessor = new MessageProcessor({
      promptBuilder: new PromptBuilder(),
      openaiService: new OpenAIService(dependencies.openai.apiKey)
    });
  }

  /**
   * Main execution method called when a message is created.
   * Processes the message if it's not ignored.
   * @param {Message} message - The Discord message that was created
   * @returns {Promise<void>}
   */
  public async execute(message: Message): Promise<void> {
    if (this.shouldIgnoreMessage(message)) return;

    try {
      await this.messageProcessor.processMessage(message);
    } catch (error) {
      await this.handleError(error, message);
    }
  }

  /**
   * Determines if a message should be ignored based on certain criteria.
   * @private
   * @param {Message} message - The message to check
   * @returns {boolean} True if the message should be ignored, false otherwise
   */
  private shouldIgnoreMessage(message: Message): boolean {
    // Logic for ignoring messages
    // 1. Ignore messages from other bots
    // 2. Ignore messages that don't either mention the bot or reply to the bot
    if (message.author.bot) return true;
    return !this.isBotMentioned(message) && !this.isReplyToBot(message);
  }

  /**
   * Checks if the bot is mentioned in the message.
   * @private
   * @param {Message} message - The message to check
   * @returns {boolean} True if the bot is mentioned, false otherwise
   */
  private isBotMentioned(message: Message): boolean {
    return message.mentions.users.has(message.client.user!.id);
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