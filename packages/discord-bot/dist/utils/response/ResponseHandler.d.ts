/**
 * ResponseHandler - Manages how the bot responds to messages
 * Will handle different response types (replies, DMs, embeds) and formatting
 */
import { Message, MessageCreateOptions, MessageReplyOptions, EmbedBuilder, TextBasedChannel, User, MessageEditOptions } from 'discord.js';
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
export declare class ResponseHandler implements IResponseHandler {
    private readonly message;
    private readonly channel;
    private readonly user;
    constructor(message: Message, channel: TextBasedChannel, user: User);
    sendText(content: string, options?: Omit<MessageReplyOptions, 'content'>): Promise<void>;
    sendEmbed(embed: EmbedBuilder, options?: Omit<MessageReplyOptions, 'embeds'>): Promise<void>;
    sendDM(content: string | MessageCreateOptions): Promise<void>;
    editMessage(messageId: string, content: string | MessageEditOptions): Promise<void>;
    addReaction(emoji: string): Promise<void>;
    /**
     * Send a typing indicator in the channel
     * @param durationMs How long to show the typing indicator (max 10s)
     */
    indicateTyping(durationMs?: number): Promise<void>;
    /**
     * Stop the typing indicator
     * Note: Discord.js doesn't provide a direct way to stop typing,
     * so this is a no-op. The typing indicator will automatically
     * stop after ~10 seconds or when a message is sent.
     */
    stopTyping(): void;
}
