/**
 * @file ResponseHandler.ts
 * @description Manages how the bot responds to messages in Discord.
 * Handles different response types including text replies, embeds, DMs, and reactions.
 */
import { EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
import { logger } from '../logger.js';
import { EmbedBuilder as CustomEmbedBuilder } from './EmbedBuilder.js';
/**
 * Handles various types of message responses for Discord interactions.
 * Manages text responses, embeds, direct messages, reactions, and typing indicators.
 * @class ResponseHandler
 */
export class ResponseHandler {
    message;
    channel;
    user;
    /**
     * Creates an instance of ResponseHandler.
     * @param {Message} message - The original Discord message that triggered the response
     * @param {TextBasedChannel} channel - The channel where the message was received
     * @param {User} user - The user who sent the original message
     */
    constructor(message, channel, user) {
        this.message = message;
        this.channel = channel;
        this.user = user;
    }
    /**
     * Sends a message to the channel with optional file attachments
     * @param {string} content - The message content to send
     * @param {Array<{filename: string, data: string | Buffer}>} [files=[]] - Optional files to attach
     * @returns {Promise<Message | Message[]>} The sent message(s)
     */
    async sendMessage(content, files = []) {
        if (!this.channel.isSendable()) {
            throw new Error('Channel is not sendable');
        }
        try {
            // If we have no content but have files, just send the files
            if (!content.trim() && files.length > 0) {
                const messageOptions = {
                    files: files.map(f => ({
                        attachment: Buffer.from(f.data),
                        name: f.filename
                    }))
                };
                return await this.channel.send(messageOptions);
            }
            // Split content into chunks using the splitMessage method
            const chunks = this.splitMessage(content);
            const messages = [];
            // If we have no files, just send all chunks as separate messages
            if (files.length === 0) {
                for (const chunk of chunks) {
                    messages.push(await this.channel.send({ content: chunk }));
                }
                return messages.length === 1 ? messages[0] : messages;
            }
            // If we have files, send all but the last chunk as regular messages
            for (let i = 0; i < chunks.length - 1; i++) {
                messages.push(await this.channel.send({ content: chunks[i] }));
            }
            // Send the last chunk with files
            const lastChunk = chunks[chunks.length - 1];
            const messageOptions = {
                content: lastChunk,
                files: files.map(f => ({
                    attachment: Buffer.from(f.data),
                    name: f.filename
                }))
            };
            messages.push(await this.channel.send(messageOptions));
            return messages.length === 1 ? messages[0] : messages;
        }
        catch (error) {
            logger.error('Failed to send message:', error);
            throw error;
        }
    }
    /**
     * Sends a text response to the channel where the message was received.
     * @param {string} content - The text content to send
     * @returns {Promise<Message | null>} The last sent message or null if sending failed
     */
    async sendText(content) {
        if (!this.channel.isSendable()) {
            throw new Error('Channel is not sendable');
        }
        const result = await this.sendMessage(content);
        return Array.isArray(result) ? result[result.length - 1] : result;
    }
    /**
     * Sends a file as an attachment to the channel.
     * @param {string} content - The content to include with the file
     * @param {string} filename - The name of the file
     * @param {string | Buffer} data - The file data as a string or Buffer
     * @returns {Promise<Message | null>} The last sent message or null if sending failed
     */
    async sendFile(content, filename, data) {
        if (!this.channel.isSendable()) {
            throw new Error('Channel is not sendable');
        }
        const result = await this.sendMessage(content, [{ filename, data }]);
        return Array.isArray(result) ? result[result.length - 1] : result;
    }
    /**
     * Sends an embedded message to the channel where the message was received.
     * @param {CustomEmbedBuilder | DiscordEmbedBuilder} embed - The embed to send
     * @param {Omit<MessageReplyOptions, 'embeds'>} [options] - Additional message options
     * @returns {Promise<void>}
     */
    async sendEmbed(embed, options = {}) {
        let discordEmbed;
        try {
            discordEmbed = embed instanceof CustomEmbedBuilder
                ? new DiscordEmbedBuilder(embed.toJSON())
                : embed;
            if (this.channel.isSendable()) {
                await this.channel.send({
                    ...options,
                    embeds: [discordEmbed]
                });
            }
            else {
                throw new Error('Channel is not sendable'); // TODO: Handle non-text channels
            }
        }
        catch (error) {
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
    async sendDM(content) {
        try {
            const dmChannel = await this.user.createDM();
            await dmChannel.send(content);
        }
        catch (error) {
            logger.error('Failed to send DM:', error);
            // Fall back to public channel if DM fails
            if (typeof content === 'string') {
                await this.sendText(`Sorry, I couldn't send you a DM.\n> ${content}`);
            }
            else {
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
    async editMessage(messageId, content) {
        try {
            const message = await this.channel.messages.fetch(messageId);
            if (message.editable) {
                await message.edit(content);
            }
        }
        catch (error) {
            logger.error('Failed to edit message:', error);
            throw error;
        }
    }
    /**
     * Adds a reaction to the original message.
     * @param {string} emoji - The emoji to react with
     * @returns {Promise<void>}
     */
    async addReaction(emoji) {
        if (!emoji?.trim())
            return;
        // Simple function to check if a string is a single emoji
        const isSingleEmoji = (str) => {
            // Unicode emoji regex that matches a single emoji
            const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;
            return emojiRegex.test(str);
        };
        try {
            // First try to react with the entire string as a single emoji
            if (isSingleEmoji(emoji.trim())) {
                await this.message.react(emoji.trim());
                return;
            }
            // If not a single emoji, try to split by spaces and react to each
            const emojis = emoji.split(/\s+/).filter(Boolean);
            for (const e of emojis) {
                try {
                    await this.message.react(e);
                    // Add a small delay between reactions to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
                catch (error) {
                    logger.warn(`Failed to react with emoji ${e}:`, error);
                    continue;
                }
            }
        }
        catch (error) {
            logger.error('Failed to process reaction:', error);
        }
    }
    /**
     * Shows a typing indicator in the channel.
     * The indicator will automatically disappear after ~10 seconds or when a message is sent.
     * @returns {Promise<void>}
     */
    async indicateTyping() {
        // Only valid for text-based channels
        if (!this.channel.isTextBased() || this.channel.isDMBased() || this.channel.isThread()) {
            return;
        }
        try {
            await this.channel.sendTyping();
        }
        catch (error) {
            logger.warn('Failed to send typing indicator:', error);
        }
    }
    /**
     * Splits a message into chunks that fit within Discord's message limits
     * @private
     */
    splitMessage(text) {
        const maxLength = 2000;
        const chunks = [];
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
                                        }
                                        else {
                                            wordChunk = word;
                                        }
                                    }
                                    else {
                                        wordChunk += (wordChunk ? ' ' : '') + word;
                                    }
                                }
                                if (wordChunk) {
                                    chunks.push(wordChunk.trim());
                                }
                            }
                            else {
                                sentenceChunk = sentence;
                            }
                        }
                        else {
                            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                        }
                    }
                    if (sentenceChunk) {
                        chunks.push(sentenceChunk.trim());
                    }
                }
                else {
                    currentChunk = paragraph;
                }
            }
            else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        return chunks;
    }
}
//# sourceMappingURL=ResponseHandler.js.map