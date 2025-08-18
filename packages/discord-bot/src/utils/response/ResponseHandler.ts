/**
 * @file ResponseHandler.ts
 * @description Manages how the bot responds to messages in Discord.
 * Handles different response types including text replies, embeds, DMs, and reactions.
 */

import { Message, MessageCreateOptions, MessageReplyOptions, EmbedBuilder, TextBasedChannel, User, MessageEditOptions } from 'discord.js';
import { logger } from '../logger.js';

/**
 * Handles various types of message responses for Discord interactions.
 * Manages text responses, embeds, direct messages, reactions, and typing indicators.
 * @class ResponseHandler
 */
export class ResponseHandler {
  /**
   * Creates an instance of ResponseHandler.
   * @param {Message} message - The original Discord message that triggered the response
   * @param {TextBasedChannel} channel - The channel where the message was received
   * @param {User} user - The user who sent the original message
   */
  constructor(
    private readonly message: Message,
    private readonly channel: TextBasedChannel,
    private readonly user: User
  ) {}

  /**
   * Sends a text response to the channel where the message was received.
   * @param {string} content - The text content to send
   * @param {Omit<MessageReplyOptions, 'content'>} [options] - Additional message options
   * @returns {Promise<void>}
   */
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

  /**
   * Sends an embedded message to the channel where the message was received.
   * @param {EmbedBuilder} embed - The embed to send
   * @param {Omit<MessageReplyOptions, 'embeds'>} [options] - Additional message options
   * @returns {Promise<void>}
   */
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

  /**
   * Sends a direct message to the user who sent the original message.
   * Falls back to a channel message if DMs are disabled.
   * @param {string | MessageCreateOptions} content - The message content or options
   * @returns {Promise<void>}
   */
  public async sendDM(content: string | MessageCreateOptions): Promise<void> {
    try {
      const dmChannel = await this.user.createDM();
      await dmChannel.send(content);
    } catch (error) {
      logger.error('Failed to send DM:', error);
      // Fall back to public channel if DM fails
      if (typeof content === 'string') {
        await this.sendText(`Sorry, I couldn't send you a DM.\n> ${content}`);
      } else {
        await this.sendText("Sorry, I couldn't send you a DM.");
      }
    }
  }

  /**
   * Edits an existing message in the channel.
   * @param {string} messageId - The ID of the message to edit
   * @param {string | MessageEditOptions} content - The new content or options
   * @returns {Promise<void>}
   * @throws Will throw an error if the message cannot be edited
   */
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

  /**
   * Adds a reaction to the original message.
   * @param {string} emoji - The emoji to react with
   * @returns {Promise<void>}
   */
  public async addReaction(emoji: string): Promise<void> {
    try {
      await this.message.react(emoji);
    } catch (error) {
      logger.error('Failed to add reaction:', error);
      // Silently fail for reactions as they're not critical
    }
  }

  /**
   * Shows a typing indicator in the channel.
   * The indicator will automatically disappear after ~10 seconds or when a message is sent.
   * @returns {Promise<void>}
   */
  public async indicateTyping(): Promise<void> {
    // Only valid for text-based channels
    if (!this.channel.isTextBased() || this.channel.isDMBased() || this.channel.isThread()) {
      return;
    }
    
    try {
      await this.channel.sendTyping();
    } catch (error) {
      logger.warn('Failed to send typing indicator:', error);
    }
  }
}
