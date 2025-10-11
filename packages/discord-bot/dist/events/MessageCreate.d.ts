/**
 * @file MessageCreate.ts
 * @description Handles the 'messageCreate' event from Discord.js, specifically for processing
 * messages that mention the bot or are replies to the bot.
 */
import { Message } from 'discord.js';
import { Event } from './Event.js';
import { OpenAIService } from '../utils/openaiService.js';
/**
 * Dependencies required for the MentionBotEvent
 * @interface Dependencies
 * @property {Object} openai - Configuration for the OpenAI service
 * @property {string} openai.apiKey - The API key for OpenAI
 * @property {OpenAIService} openaiService - The OpenAI service instance
 */
interface Dependencies {
    openai: {
        apiKey: string;
    };
    openaiService: OpenAIService;
}
/**
 * Handles messages that mention the bot or are replies to the bot.
 * Extends the base Event class to process messages and generate responses.
 * @class MentionBotEvent
 * @extends {Event}
 */
export declare class MessageCreate extends Event {
    readonly name: "messageCreate";
    readonly once = false;
    private readonly messageProcessor;
    private readonly CATCHUP_AFTER_MESSAGES;
    private readonly CATCHUP_IF_MENTIONED_AFTER_MESSAGES;
    private readonly channelMessageCounters;
    private readonly STALE_COUNTER_TTL_MS;
    private readonly allowedThreadIds;
    private readonly botConversationStates;
    private readonly BOT_CONVERSATION_TTL_MS;
    private readonly BOT_INTERACTION_COOLDOWN_MS;
    /**
     * Creates an instance of MentionBotEvent
     * @param {Dependencies} dependencies - Required dependencies including OpenAI configuration
     */
    constructor(dependencies: Dependencies);
    /**
     * Main execution method called when a message is created.
     * Processes the message if it's not ignored.
     * @param {Message} message - The Discord message that was created
     * @returns {Promise<void>}
     */
    execute(message: Message): Promise<void>;
    /**
     * Checks if the bot is mentioned in the message.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the bot is mentioned, false otherwise
     */
    private isBotMentioned;
    /**
     * Checks if the message is a reply to the bot.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the message is a reply to the bot, false otherwise
     */
    private isReplyToBot;
    /**
     * Checks if A. the message is in a thread, and B. the thread is in a disallowed thread.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the message is in a disallowed thread, false otherwise
     */
    private disallowedThread;
    private getChannelCounterKey;
    private resetCounter;
    private incrementCounter;
    private cleanupStaleCounters;
    /**
     * Handles errors that occur during message processing.
     * Logs the error and attempts to notify the user.
     * @private
     * @param {unknown} error - The error that occurred
     * @param {Message} message - The message that was being processed when the error occurred
     * @returns {Promise<void>}
     */
    private handleError;
    /**
     * Determines whether we should refuse to respond to another bot in order to avoid
     * two automated agents getting stuck in an infinite loop. The method keeps lightweight
     * state per channel so that we can cap the number of back-and-forth exchanges while
     * still allowing occasional hand-offs between bots.
     */
    private shouldSuppressBotResponse;
    /**
     * Adds the configured emoji reaction (when enabled) to acknowledge the other bot without
     * sending a full reply. Errors are swallowed so that a failure to react does not break
     * the main message handling pipeline.
     */
    private reactToSuppressedBotMessage;
    /**
     * Marks that Daneel has spoken in the tracked channel so that the next bot message counts
     * as a new exchange when calculating the back-and-forth limit.
     */
    private markBotMessageSent;
    /**
     * Periodically purge stale bot conversation tracking entries to prevent unbounded memory growth.
     */
    private cleanupStaleBotConversations;
}
export {};
