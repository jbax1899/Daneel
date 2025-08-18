/**
 * @file ResponseHandler.ts
 * @description Manages how the bot responds to messages in Discord.
 * Handles different response types including text replies, embeds, DMs, and reactions.
 */
import { Message, MessageCreateOptions, MessageReplyOptions, EmbedBuilder, TextBasedChannel, User, MessageEditOptions } from 'discord.js';
/**
 * Handles various types of message responses for Discord interactions.
 * Manages text responses, embeds, direct messages, reactions, and typing indicators.
 * @class ResponseHandler
 */
export declare class ResponseHandler {
    private readonly message;
    private readonly channel;
    private readonly user;
    /**
     * Creates an instance of ResponseHandler.
     * @param {Message} message - The original Discord message that triggered the response
     * @param {TextBasedChannel} channel - The channel where the message was received
     * @param {User} user - The user who sent the original message
     */
    constructor(message: Message, channel: TextBasedChannel, user: User);
    /**
     * Sends a text response to the channel where the message was received.
     * @param {string} content - The text content to send
     * @param {Omit<MessageReplyOptions, 'content'>} [options] - Additional message options
     * @returns {Promise<void>}
     */
    sendText(content: string, options?: Omit<MessageReplyOptions, 'content'>): Promise<void>;
    /**
     * Sends an embedded message to the channel where the message was received.
     * @param {EmbedBuilder} embed - The embed to send
     * @param {Omit<MessageReplyOptions, 'embeds'>} [options] - Additional message options
     * @returns {Promise<void>}
     */
    sendEmbed(embed: EmbedBuilder, options?: Omit<MessageReplyOptions, 'embeds'>): Promise<void>;
    /**
     * Sends a direct message to the user who sent the original message.
     * Falls back to a channel message if DMs are disabled.
     * @param {string | MessageCreateOptions} content - The message content or options
     * @returns {Promise<void>}
     */
    sendDM(content: string | MessageCreateOptions): Promise<void>;
    /**
     * Edits an existing message in the channel.
     * @param {string} messageId - The ID of the message to edit
     * @param {string | MessageEditOptions} content - The new content or options
     * @returns {Promise<void>}
     * @throws Will throw an error if the message cannot be edited
     */
    editMessage(messageId: string, content: string | MessageEditOptions): Promise<void>;
    /**
     * Adds a reaction to the original message.
     * @param {string} emoji - The emoji to react with
     * @returns {Promise<void>}
     */
    addReaction(emoji: string): Promise<void>;
    /**
     * Shows a typing indicator in the channel.
     * The indicator will automatically disappear after ~10 seconds or when a message is sent.
     * @returns {Promise<void>}
     */
    indicateTyping(): Promise<void>;
}
