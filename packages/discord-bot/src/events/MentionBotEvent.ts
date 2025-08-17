import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { DiscordPromptBuilder } from '../utils/prompting/PromptBuilder.js';

export class MentionBotEvent extends Event {
  public name = 'messageCreate' as const;
  public once = false;
  private openaiService: OpenAIService;
  private promptBuilder: DiscordPromptBuilder;

  constructor(dependencies: { openai: any }) {
    super({ name: 'messageCreate', once: false });
    this.openaiService = new OpenAIService(dependencies.openai.apiKey);
    this.promptBuilder = new DiscordPromptBuilder();
  }

  async execute(message: Message): Promise<void> {
    if (message.author.bot) return;

    const isMentioned = message.mentions.users.has(message.client.user!.id);
    const isReplyToBot = message.reference?.messageId && 
                       message.reference.guildId === message.guildId &&
                       message.reference.channelId === message.channelId &&
                       message.mentions.repliedUser?.id === message.client.user!.id;

    if (!isMentioned && !isReplyToBot) return;

    try {
      if (message.channel.isTextBased() && !message.channel.isDMBased() && !message.channel.isThread()) {
        await message.channel.sendTyping();
      }

      const context = await this.promptBuilder.buildContext(message, {
        userId: message.author.id,
        username: message.author.username,
        isMentioned,
        isReplyToBot
      });

      const response = await this.openaiService.generateResponse(context);
      
      if (response) {
        if (response.length > 2000) {
          const chunks = response.match(/[\s\S]{1,2000}/g) || [];
          for (const chunk of chunks) {
            await message.reply(chunk);
          }
        } else {
          await message.reply(response);
        }
      }
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