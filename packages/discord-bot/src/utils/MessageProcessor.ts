/**
 * MessageProcessor - Coordinates the message handling flow
 * Manages the process from receiving a message to sending a response
 */

import type { Message } from 'discord.js';
import { DiscordPromptBuilder } from './prompting/PromptBuilder.js';
import { OpenAIService } from './openaiService.js';
import { logger } from './logger.js';
import { ResponseHandler } from './response/ResponseHandler.js';

export interface IMessageProcessor {
  processMessage(message: Message): Promise<void>;
}

export interface MessageProcessorDependencies {
  promptBuilder: DiscordPromptBuilder;
  openaiService: OpenAIService;
}

export class MessageProcessor implements IMessageProcessor {
  private readonly promptBuilder: DiscordPromptBuilder;
  private readonly openaiService: OpenAIService;

  constructor(dependencies: MessageProcessorDependencies) {
    this.promptBuilder = dependencies.promptBuilder;
    this.openaiService = dependencies.openaiService;
  }

  async processMessage(message: Message): Promise<void> {
    const responseHandler = new ResponseHandler(message, message.channel, message.author);
    
    try {
      // 1. Validate message
      if (!this.isValidMessage(message)) {
        return;
      }

      // 2. Show typing indicator
      await responseHandler.indicateTyping(5000);

      // 3. Build context and get AI response
      const context = await this.buildMessageContext(message);
      const response = await this.openaiService.generateResponse(context);

      // 4. Handle the response
      if (response) {
        await this.handleResponse(responseHandler, response);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      await this.handleError(responseHandler, error);
    }
  }

  private isValidMessage(message: Message): boolean {
    return !message.author.bot && message.content.trim().length > 0;
  }

  private async buildMessageContext(message: Message) {
    return this.promptBuilder.buildContext(message, {
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channelId,
      guildId: message.guildId,
    });
  }

  private async handleResponse(responseHandler: ResponseHandler, response: string): Promise<void> {
    if (response.length > 2000) {
      const chunks = response.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await responseHandler.sendText(chunk);
      }
    } else {
      await responseHandler.sendText(response);
    }
  }

  private async handleError(responseHandler: ResponseHandler, error: unknown): Promise<void> {
    logger.error('Error in MessageProcessor:', error);
    try {
      await responseHandler.sendText('Sorry, I encountered an error processing your message.');
    } catch (replyError) {
      logger.error('Failed to send error reply:', replyError);
    }
  }
}
