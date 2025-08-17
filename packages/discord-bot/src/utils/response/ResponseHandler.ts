/**
 * ResponseHandler - Manages how the bot responds to messages
 * Will handle different response types (replies, DMs, embeds) and formatting
 */

import { Message, MessageCreateOptions, MessageReplyOptions, EmbedBuilder, TextBasedChannel, User, MessageEditOptions } from 'discord.js';
import { logger } from '../logger.js';

export interface IResponseHandler {
  /**
   * Send a text response to a message
   * @param content The text content to send
   * @param options Additional message options
   */
  sendText(content: string, options?: Omit<MessageReplyOptions, 'content'>): Promise<void>;
  
  /**
   * Send an embedded response
   * @param embed The embed to send
   * @param options Additional message options
   */
  sendEmbed(embed: EmbedBuilder, options?: Omit<MessageReplyOptions, 'embeds'>): Promise<void>;
  
  /**
   * Send a direct message to the user
   * @param content The message content or options
   */
  sendDM(content: string | MessageCreateOptions): Promise<void>;
  
  /**
   * Edit an existing message
   * @param messageId The ID of the message to edit
   * @param content The new content or options
   */
  editMessage(messageId: string, content: string | MessageEditOptions): Promise<void>;
  
  /**
   * Add a reaction to a message
   * @param emoji The emoji to react with
   */
  addReaction(emoji: string): Promise<void>;
}

export class ResponseHandler implements IResponseHandler {
  constructor(
    private readonly message: Message,
    private readonly channel: TextBasedChannel,
    private readonly user: User
  ) {}

  public async sendText(content: string, options: Omit<MessageReplyOptions, 'content'> = {}): Promise<void> {
    try {
      await this.message.reply({
        content,
        ...options,
        allowedMentions: { repliedUser: false, ...options.allowedMentions }
      });
    } catch (error) {
      logger.error('Failed to send text response:', error);
      throw error;
    }
  }

  public async sendEmbed(embed: EmbedBuilder, options: Omit<MessageReplyOptions, 'embeds'> = {}): Promise<void> {
    try {
      await this.message.reply({
        embeds: [embed],
        ...options,
        allowedMentions: { repliedUser: false, ...options.allowedMentions }
      });
    } catch (error) {
      logger.error('Failed to send embed response:', error);
      throw error;
    }
  }

  public async sendDM(content: string | MessageCreateOptions): Promise<void> {
    try {
      const dmChannel = await this.user.createDM();
      await dmChannel.send(content);
    } catch (error) {
      logger.error('Failed to send DM:', error);
      // Fall back to public channel if DM fails
      if (typeof content === 'string') {
        await this.sendText(`I couldn't send you a DM. Please check your privacy settings.\n> ${content}`);
      } else {
        await this.sendText("I couldn't send you a DM. Please check your privacy settings.");
      }
    }
  }

  public async editMessage(messageId: string, content: string | MessageEditOptions): Promise<void> {
    try {
      const message = await this.channel.messages.fetch(messageId);
      if (message.editable) {
        await message.edit(content);
      }
    } catch (error) {
      logger.error('Failed to edit message:', error);
      throw error;
    }
  }

  public async addReaction(emoji: string): Promise<void> {
    try {
      await this.message.react(emoji);
    } catch (error) {
      logger.error('Failed to add reaction:', error);
      // Silently fail for reactions as they're not critical
    }
  }

  /**
   * Send a typing indicator in the channel
   * @param durationMs How long to show the typing indicator (max 10s)
   */
  public async indicateTyping(durationMs: number = 5000): Promise<void> {
    if (!this.channel.isTextBased() || this.channel.isDMBased() || this.channel.isThread()) {
      return;
    }

    try {
      await this.channel.sendTyping();
      
      // Automatically stop typing after duration (max 10s as per Discord's limit)
      const typingDuration = Math.min(durationMs, 10000);
      if (typingDuration > 0) {
        setTimeout(() => this.stopTyping(), typingDuration);
      }
    } catch (error) {
      logger.warn('Failed to send typing indicator:', error);
    }
  }

  /**
   * Stop the typing indicator
   * Note: Discord.js doesn't provide a direct way to stop typing,
   * so this is a no-op. The typing indicator will automatically
   * stop after ~10 seconds or when a message is sent.
   */
  public stopTyping(): void {
    // No-op - typing indicator stops automatically
  }
}
