/**
 * @file MessageProcessor.ts
 * @description Coordinates the message handling flow for the Discord bot.
 * Manages the complete process from receiving a message to sending a response,
 * including validation, context building, and response handling.
 */

import type { Message } from 'discord.js';
import { PromptBuilder } from './prompting/PromptBuilder.js';
import { OpenAIService } from './openaiService.js';
import { logger } from './logger.js';
import { ResponseHandler } from './response/ResponseHandler.js';

/**
 * Configuration object for initializing MessageProcessor.
 * @typedef {Object} MessageProcessorOptions
 * @property {PromptBuilder} promptBuilder - The prompt builder for creating message contexts
 * @property {OpenAIService} openaiService - The service for generating AI responses
 */
type MessageProcessorOptions = {
  promptBuilder: PromptBuilder;
  openaiService: OpenAIService;
};

/**
 * Handles the complete message processing pipeline for the Discord bot.
 * Coordinates validation, context building, AI response generation, and response handling.
 * @class MessageProcessor
 */
export class MessageProcessor {
  private readonly promptBuilder: PromptBuilder;
  private readonly openaiService: OpenAIService;

  /**
   * Creates an instance of MessageProcessor.
   * @param {MessageProcessorOptions} options - Configuration options
   */
  constructor(options: MessageProcessorOptions) {
    this.promptBuilder = options.promptBuilder;
    this.openaiService = options.openaiService;
  }

  /**
   * Processes an incoming Discord message.
   * @param {Message} message - The Discord message to process
   * @returns {Promise<void>}
   */
  public async processMessage(message: Message): Promise<void> {
    const responseHandler = new ResponseHandler(message, message.channel, message.author);
    
    try {
      // 1. Validate message
      if (!this.isValidMessage(message)) {
        return;
      }

      // 2. Show typing indicator
      await responseHandler.indicateTyping();

      // 3. Build context and get AI response
      const context = await this.buildMessageContext(message);
      const response = await this.openaiService.generateResponse(context);

      // 4. Handle the response
      if (response) {
        await this.handleResponse(responseHandler, response, context);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      await this.handleError(responseHandler, error);
    }
  }

  /**
   * Validates if a message should be processed.
   * @private
   * @param {Message} message - The message to validate
   * @returns {boolean} True if the message is valid, false otherwise
   */
  private isValidMessage(message: Message): boolean {
    return !message.author.bot && message.content.trim().length > 0;
  }

  /**
   * Builds the context for an AI response based on the message.
   * @private
   * @param {Message} message - The Discord message
   * @returns {Promise<any[]>} The constructed message context
   */
  private async buildMessageContext(message: Message): Promise<any[]> {
    return this.promptBuilder.buildContext(message, {
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channelId,
      guildId: message.guildId,
    });
  }

  /**
   * Handles the AI response, including formatting and chunking if needed.
   * @private
   * @param {ResponseHandler} responseHandler - The response handler for sending messages
   * @param {string} response - The AI-generated response
   * @param {any[]} context - The context used for the AI response
   * @returns {Promise<void>}
   */
  private async handleResponse(
    responseHandler: ResponseHandler, 
    response: string, 
    context: any[]
  ): Promise<void> {
    let finalResponse = response;
    
    // In development, prepend the context if available
    if (process.env.NODE_ENV === 'development' && context) {
      const contextString = context.map(c => 
        typeof c === 'string' ? c : JSON.stringify(c, null, 2)
      ).join('\n\n---\n\n');
      
      finalResponse = `Full context:\n\`\`\`\n${contextString}\n\`\`\`\n\n${response}`;
    }

    // Handle long messages by splitting them into chunks
    if (finalResponse.length > 2000) {
      const chunks = finalResponse.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await responseHandler.sendText(chunk);
      }
    } else {
      await responseHandler.sendText(finalResponse);
    }
  }

  /**
   * Handles errors that occur during message processing.
   * @private
   * @param {ResponseHandler} responseHandler - The response handler for error messages
   * @param {unknown} error - The error that occurred
   * @returns {Promise<void>}
   */
  private async handleError(responseHandler: ResponseHandler, error: unknown): Promise<void> {
    logger.error('Error in MessageProcessor:', error);
    try {
      await responseHandler.sendText('Sorry, I encountered an error processing your message.');
    } catch (replyError) {
      logger.error('Failed to send error reply:', replyError);
    }
  }
}
