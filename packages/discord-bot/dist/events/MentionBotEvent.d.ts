/**
 * @file MentionBotEvent.ts
 * @description Handles the 'messageCreate' event from Discord.js, specifically for processing
 * messages that mention the bot or are replies to the bot.
 */
import { Message } from 'discord.js';
import { Event } from './Event.js';
import { OpenAIService } from '../utils/OpenAIService.js';
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
export declare class MentionBotEvent extends Event {
    /** The Discord.js event name this handler is registered for */
    readonly name: "messageCreate";
    /** Whether the event should only be handled once (false for message events) */
    readonly once = false;
    /** The message processor that handles the actual message processing logic */
    private readonly messageProcessor;
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
     * Determines if a message should be ignored based on certain criteria.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the message should be ignored, false otherwise
     */
    private shouldIgnoreMessage;
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
     * Handles errors that occur during message processing.
     * Logs the error and attempts to notify the user.
     * @private
     * @param {unknown} error - The error that occurred
     * @param {Message} message - The message that was being processed when the error occurred
     * @returns {Promise<void>}
     */
    private handleError;
}
export {};
