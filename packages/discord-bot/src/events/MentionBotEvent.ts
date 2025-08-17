import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { DiscordPromptBuilder } from '../utils/prompting/PromptBuilder.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';

export class MentionBotEvent extends Event {
  public name = 'messageCreate' as const;
  public once = false;
  private messageProcessor: MessageProcessor;

  constructor(dependencies: { openai: any }) {
    super({ name: 'messageCreate', once: false });

    this.messageProcessor = new MessageProcessor({
      promptBuilder: new DiscordPromptBuilder(),
      openaiService: new OpenAIService(dependencies.openai.apiKey)
    });
  }

  async execute(message: Message): Promise<void> {
    // Ignore messages from bots
    if (message.author.bot) return;
  
    const isMentioned = message.mentions.users.has(message.client.user!.id);
    const isReplyToBot = message.reference?.messageId && 
      message.reference.guildId === message.guildId &&
      message.reference.channelId === message.channelId &&
      message.mentions.repliedUser?.id === message.client.user!.id;

    // Ignore messages that are not one of:
    // - A mention of the bot (@Daneel)
    // - A reply to the bot
    if (!isMentioned && !isReplyToBot) return;

    try {
      if (message.channel.isTextBased() && !message.channel.isDMBased() && !message.channel.isThread()) {
        await message.channel.sendTyping();
      }
      
      await this.messageProcessor.processMessage(message);
    } catch (error) {
      logger.error('Error in MentionBotEvent:', error);
      try {
        await message.reply('Sorry, I encountered an error while processing your message.');
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  }
}