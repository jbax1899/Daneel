/**
 * MessageProcessor - Coordinates the message handling flow
 * Manages the process from receiving a message to sending a response
 */

import type { Message } from 'discord.js';
import { DiscordPromptBuilder } from './prompting/PromptBuilder.js';
import { OpenAIService } from './openaiService.js';
import { logger } from './logger.js';

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
    try {
      // 1. Validate message
      if (!this.isValidMessage(message)) {
        return;
      }

      // 2. Build context and get AI response
      const context = await this.buildMessageContext(message);
      const response = await this.openaiService.generateResponse(context);

      // 3. Handle the response
      if (response) {
        await this.handleResponse(message, response);
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      await this.handleError(message, error);
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

  private async handleResponse(message: Message, response: string): Promise<void> {
    if (response.length > 2000) {
      const chunks = response.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
  }

  private async handleError(message: Message, error: unknown): Promise<void> {
    logger.error('Error processing message:', error);
    try {
      await message.reply('Sorry, I encountered an error processing your message.');
    } catch (replyError) {
      logger.error('Failed to send error reply:', replyError);
    }
  }
}
