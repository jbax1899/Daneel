/**
 * @file ResponseHandler.ts
 * @description Manages how the bot responds to messages in Discord.
 * Handles different response types including text replies, embeds, DMs, and reactions.
 */
import { Message, MessageCreateOptions, MessageReplyOptions, EmbedBuilder as DiscordEmbedBuilder, TextBasedChannel, User, MessageEditOptions, ActivityOptions } from 'discord.js';
import { EmbedBuilder as CustomEmbedBuilder } from './EmbedBuilder.js';
/**
 * Handles various types of message responses for Discord interactions.
 * Manages text responses, embeds, direct messages, reactions, and typing indicators.
 * @class ResponseHandler
 */
export declare class ResponseHandler {
    private readonly message;
    private readonly channel;
    private readonly user;
    private typingInterval;
    private readonly TYPING_INTERVAL_MS;
    /**
     * Creates an instance of ResponseHandler.
     * @param {Message} message - The original Discord message that triggered the response
     * @param {TextBasedChannel} channel - The channel where the message was received
     * @param {User} user - The user who sent the original message
     */
    constructor(message: Message, channel: TextBasedChannel, user: User);
    /**
     * Sends a message to the channel with optional file attachments
     * @param {string} content - The message content to send
     * @param {Array<{filename: string, data: string | Buffer}>} [files=[]] - Optional files to attach
     * @param {Object} [replyToMessage] - Optional message reference for replies
     * @returns {Promise<Message | Message[]>} The sent message(s)
     */
    sendMessage(content: string, files?: Array<{
        filename: string;
        data: string | Buffer;
    }>, directReply?: boolean, suppressEmbeds?: boolean, components?: MessageCreateOptions['components']): Promise<Message | Message[]>;
    /**
     * Sends a single embed with optional attachments and interactive components.
     * This is primarily used by automated image responses so we can ship the
     * generated asset, metadata attachment, and variation buttons in one payload.
     */
    sendEmbedMessage(embed: DiscordEmbedBuilder, { content, files, directReply, components }?: {
        content?: string;
        files?: Array<{
            filename: string;
            data: string | Buffer;
        }>;
        directReply?: boolean;
        components?: MessageCreateOptions['components'];
    }): Promise<Message>;
    /**
     * Sends an embedded message to the channel where the message was received.
     * @param {CustomEmbedBuilder | DiscordEmbedBuilder} embed - The embed to send
     * @param {Omit<MessageReplyOptions, 'embeds'>} [options] - Additional message options
     * @returns {Promise<void>}
     */
    sendEmbed(embed: CustomEmbedBuilder | DiscordEmbedBuilder, options?: Omit<MessageReplyOptions, 'embeds'>): Promise<void>;
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
    /**
     * Shows a typing indicator in the channel and keeps it active until stopTyping is called
     * @returns {Promise<void>}
     */
    startTyping(): Promise<void>;
    /**
     * Stops the typing indicator
     * @returns {void}
     */
    stopTyping(): void;
    /**
     * Sets the bot's presence with customizable options.
     *
     * @param {Object} options - Presence configuration options
     * @param {'online'|'idle'|'dnd'|'invisible'} [options.status='online']
     *        The overall status of the bot.
     * @param {Array<ActivityOptions>} [options.activities=[]]
     *        Array of activity objects to display (e.g. "Playing X").
     * @param {number|null} [options.shardId=null]
     *        The shard ID to apply the presence to. Optional, and usually not needed
     *        unless the bot is running with multiple shards. If omitted or null,
     *        the presence applies globally.
     * @param {boolean} [options.afk=false]
     *        Whether the bot should be flagged as AFK.
     * @returns {void}
     *
     * @example
     * // Basic example: playing a game
     * setPresence({
     *   status: 'online',
     *   activities: [{ name: 'with TypeScript', type: ActivityType.Playing }],
     *   afk: false
     * });
     *
     * @example
     * // Advanced: streaming
     * setPresence({
     *   status: 'dnd',
     *   activities: [{ name: 'my coding stream', type: ActivityType.Streaming, url: 'https://twitch.tv/mychannel' }]
     * });
     */
    setPresence({ status, activities, shardId, afk, }?: {
        status?: 'online' | 'idle' | 'dnd' | 'invisible';
        activities?: ActivityOptions[];
        shardId?: number | null;
        afk?: boolean;
    }): void;
    /**
     * Splits a message into chunks that fit within Discord's message limits
     * @private
     */
    private splitMessage;
}
