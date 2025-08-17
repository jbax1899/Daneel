import { Message } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';

export class MentionBotEvent extends Event {
  public name = 'messageCreate' as const;
  public once = false;
  private openai: any;

  constructor(dependencies: { openai: any }) {
    super({ name: 'messageCreate', once: false });
    this.openai = dependencies.openai;
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
      logger.debug('Processing message for MentionBotEvent');
      if (message.channel.isTextBased() && !message.channel.isDMBased() && !message.channel.isThread()) {
        await message.channel.sendTyping();
      }

      const messages = await message.channel.messages.fetch({ limit: 10 });
      const conversation = Array.from(messages.values())
        .reverse()
        .filter(msg => msg.content.trim().length > 0)
        .map(msg => ({
          role: msg.author.id === message.client.user!.id ? 'assistant' as const : 'user' as const,
          content: msg.content.replace(`<@${message.client.user!.id}>`, '').trim()
        }));

      logger.debug('Sending request to OpenAI');
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are Daneel (or Danny), a helpful AI assistant in a Discord server.
            You are named after R. Daneel Olivaw, a fictional robot created by Isaac Asimov.
            Keep responses concise, friendly, and on-topic.
            You can be called with @Daneel or by replying to your messages.`
          },
          ...conversation
        ],
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content;
      
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
      } catch (e) {
        logger.error('Failed to send error message:', e);
      }
    }
  }
}