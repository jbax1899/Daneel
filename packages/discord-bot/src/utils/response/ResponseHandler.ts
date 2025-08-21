/**
 * @file ResponseHandler.ts
 * @description Manages how the bot responds to messages in Discord.
 * Handles different response types including text replies, embeds, DMs, and reactions.
 */

import { Message, MessageCreateOptions, MessageReplyOptions, EmbedBuilder as DiscordEmbedBuilder, TextBasedChannel, User, MessageEditOptions } from 'discord.js';
import { logger } from '../logger.js';
import { EmbedBuilder as CustomEmbedBuilder } from './EmbedBuilder.js';

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
   * Sends a message to the channel with optional file attachments
   * @param {string} content - The message content to send
   * @param {Array<{filename: string, data: string | Buffer}>} [files=[]] - Optional files to attach
   * @returns {Promise<Message | Message[]>} The sent message(s)
   */
  public async sendMessage(
    content: string,
    files?: Array<{filename: string, data: string | Buffer}>,
    replyToMessage?: Message
  ): Promise<Message | Message[]> {
    if (!this.channel.isSendable()) {
      throw new Error('Channel is not sendable');
    }

    try {
      // Split content into chunks using the splitMessage method
      const chunks = this.splitMessage(content);
      const messages: Message[] = [];

      // Build messages
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isFirstChunk = i === 0;
        const isLastChunk = i === chunks.length - 1;
        const hasFiles = files && files.length > 0;

        if (isFirstChunk && replyToMessage) {
          // For first chunk with reply, always use reply()
          if (isLastChunk && hasFiles) {
            // If this is also the last chunk and we have files, include them
            messages.push(await replyToMessage.reply({ 
              content: chunk,
              files: files.map(f => ({
                attachment: Buffer.from(f.data),
                name: f.filename
              }))
            }));
          } else {
            // Otherwise just reply with text
            messages.push(await replyToMessage.reply({ content: chunk }));
          }
        } 
        else if (isLastChunk && hasFiles) {
          // Last chunk with files but not a reply
          messages.push(await this.channel.send({ 
            content: chunk, 
            files: files.map(f => ({
              attachment: Buffer.from(f.data),
              name: f.filename
            }))
          }));
        }
        else {
          // Regular message
          messages.push(await this.channel.send({ content: chunk }));
        }
      }

      return messages.length === 1 ? messages[0] : messages;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Sends a file as an attachment to the channel.
   * @param {string} content - The content to include with the file
   * @param {string} filename - The name of the file
   * @param {string | Buffer} data - The file data as a string or Buffer
   * @returns {Promise<Message | null>} The last sent message or null if sending failed
   */
  public async sendFile(
    content: string,
    filename: string,
    data: string | Buffer,
    replyToMessage?: Message
  ): Promise<Message | null> {
    if (!this.channel.isSendable()) {
      throw new Error('Channel is not sendable');
    }
    
    const result = await this.sendMessage(content, [{ filename, data }], replyToMessage);
    return Array.isArray(result) ? result[result.length - 1] : result;
  }

  /**
   * Sends an embedded message to the channel where the message was received.
   * @param {CustomEmbedBuilder | DiscordEmbedBuilder} embed - The embed to send
   * @param {Omit<MessageReplyOptions, 'embeds'>} [options] - Additional message options
   * @returns {Promise<void>}
   */
  public async sendEmbed(
    embed: CustomEmbedBuilder | DiscordEmbedBuilder,
    options: Omit<MessageReplyOptions, 'embeds'> = {}
  ): Promise<void> {
    let discordEmbed: DiscordEmbedBuilder;
    
    try {
      discordEmbed = embed instanceof CustomEmbedBuilder 
        ? new DiscordEmbedBuilder(embed.toJSON())
        : embed;

      if (this.channel.isSendable()) {
        await this.channel.send({
          ...options,
          embeds: [discordEmbed]
        });
      } else {
        throw new Error('Channel is not sendable'); // TODO: Handle non-text channels
      }
    } catch (error) {
      logger.error('Failed to send embed:', error);
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
        await this.sendMessage(`Sorry, I couldn't send you a DM.\n> ${content}`);
      } else {
        await this.sendMessage("Sorry, I couldn't send you a DM.");
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
    if (!emoji?.trim()) return;
  
    const MAX_REACTIONS = 20; // Discord's limit
    const isEmoji = (str: string): boolean => {
      const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
      return emojiRegex.test(str);
    };
  
    try {
      let reactionCount = 0;
      
      for (const char of emoji) {
        if (reactionCount >= MAX_REACTIONS) {
          logger.debug(`Reached maximum of ${MAX_REACTIONS} reactions`);
          break;
        }
        
        if (isEmoji(char)) {
          try {
            await this.message.react(char);
            reactionCount++;
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error) {
            logger.warn(`Failed to react with emoji ${char}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Error adding reactions:', error);
      throw error;
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

  /**
   * Splits a message into chunks that fit within Discord's message limits
   * @private
   */
  private splitMessage(text: string): string[] {
    const maxLength = 2000; // Discord's limit
    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by paragraphs first to maintain readability
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed the limit, push current chunk and start a new one
      if (currentChunk.length + paragraph.length + 2 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If a single paragraph is too long, split it by sentences
        if (paragraph.length > maxLength) {
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length + 1 > maxLength) {
              if (sentenceChunk) {
                chunks.push(sentenceChunk.trim());
                sentenceChunk = '';
              }
              
              // If a single sentence is still too long, split by words
              if (sentence.length > maxLength) {
                const words = sentence.split(/\s+/);
                let wordChunk = '';
                
                for (const word of words) {
                  if (wordChunk.length + word.length + 1 > maxLength) {
                    if (wordChunk) {
                      chunks.push(wordChunk.trim());
                      wordChunk = '';
                    }
                    
                    // If a single word is too long, split it
                    if (word.length > maxLength) {
                      for (let i = 0; i < word.length; i += maxLength) {
                        chunks.push(word.substring(i, i + maxLength));
                      }
                    } else {
                      wordChunk = word;
                    }
                  } else {
                    wordChunk += (wordChunk ? ' ' : '') + word;
                  }
                }
                
                if (wordChunk) {
                  chunks.push(wordChunk.trim());
                }
              } else {
                sentenceChunk = sentence;
              }
            } else {
              sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
            }
          }
          
          if (sentenceChunk) {
            chunks.push(sentenceChunk.trim());
          }
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}
