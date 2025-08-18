/**
 * @file MessageProcessor.ts
 * @description Coordinates the message handling flow for the Discord bot.
 * Manages the complete process from receiving a message to sending a response,
 * including validation, context building, and response handling.
 */
import { Message } from 'discord.js';
import { PromptBuilder } from './prompting/PromptBuilder.js';
import { OpenAIService } from './openaiService.js';
/**
 * Configuration object for initializing MessageProcessor.
 * @typedef {Object} MessageProcessorOptions
 * @property {PromptBuilder} promptBuilder - The prompt builder for creating message contexts
 * @property {OpenAIService} openaiService - The service for generating AI responses
 */
type MessageProcessorOptions = {
    promptBuilder: PromptBuilder;
    openaiService: OpenAIService;
};
/**
 * Handles the complete message processing pipeline for the Discord bot.
 * Coordinates validation, context building, AI response generation, and response handling.
 * @class MessageProcessor
 */
export declare class MessageProcessor {
    private readonly promptBuilder;
    private readonly openaiService;
    private readonly rateLimiters;
    /**
     * Creates an instance of MessageProcessor.
     * @param {MessageProcessorOptions} options - Configuration options
     */
    constructor(options: MessageProcessorOptions);
    /**
     * Processes an incoming Discord message.
     * @param {Message} message - The Discord message to process
     * @returns {Promise<void>}
     */
    processMessage(message: Message): Promise<void>;
    /**
     * Validates if a message should be processed.
     * @private
     * @param {Message} message - The message to validate
     * @returns {boolean} True if the message is valid, false otherwise
     */
    private isValidMessage;
    /**
     * Builds the context for an AI response based on the message.
     * @private
     * @param {Message} message - The Discord message
     * @returns {Promise<{context: any[], options: BuildPromptOptions}>} The constructed message context and options
     */
    private buildMessageContext;
    /**
     * Handles the AI response, including formatting and chunking if needed.
     * @private
     * @param {ResponseHandler} responseHandler - The response handler for sending messages
     * @param {string} response - The AI-generated response
     * @param {any[]} context - The context used for the AI response
     * @param {BuildPromptOptions} options - The options used for the AI response
     * @returns {Promise<void>}
     */
    private handleResponse;
    /**
     * Checks all applicable rate limits for a message.
     * @private
     * @param {Message} message - The Discord message
     * @returns {{allowed: boolean, error?: string}} Rate limit check result
     */
    private checkRateLimits;
    /**
     * Handles errors that occur during message processing.
     * @private
     * @param {ResponseHandler} responseHandler - The response handler for error messages
     * @param {unknown} error - The error that occurred
     * @returns {Promise<void>}
     */
    private handleError;
}
export {};
