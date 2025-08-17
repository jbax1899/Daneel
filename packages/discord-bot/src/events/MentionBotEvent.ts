import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { DiscordPromptBuilder } from '../utils/prompting/PromptBuilder.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';

interface Dependencies {
  openai: {
    apiKey: string;
  };
}

export class MentionBotEvent extends Event {
  public readonly name = 'messageCreate' as const; // The event name from discord.js that we are listening to
  public readonly once = false;
  private readonly messageProcessor: MessageProcessor;

  constructor(dependencies: Dependencies) {
    super({ name: 'messageCreate', once: false });
    this.messageProcessor = new MessageProcessor({
      promptBuilder: new DiscordPromptBuilder(),
      openaiService: new OpenAIService(dependencies.openai.apiKey)
    });
  }

  public async execute(message: Message): Promise<void> {
    if (this.shouldIgnoreMessage(message)) return;

    try {
      await this.messageProcessor.processMessage(message);
    } catch (error) {
      await this.handleError(error, message);
    }
  }

  private shouldIgnoreMessage(message: Message): boolean {
    // Logic for ignoring messages
    // 1. Ignore messages from other bots
    // 2. Ignore messages that don't either mention the bot or reply to the bot
    if (message.author.bot) return true;
    return !this.isBotMentioned(message) && !this.isReplyToBot(message);
  }

  private isBotMentioned(message: Message): boolean {
    return message.mentions.users.has(message.client.user!.id);
  }

  private isReplyToBot(message: Message): boolean {
    if (!message.reference?.messageId) return false;
    
    const isSameChannel = message.reference.guildId === message.guildId &&
                        message.reference.channelId === message.channelId;
    const isReplyingToBot = message.mentions.repliedUser?.id === message.client.user!.id;
    
    return isSameChannel && isReplyingToBot;
  }

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