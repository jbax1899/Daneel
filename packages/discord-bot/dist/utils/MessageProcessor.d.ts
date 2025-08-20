/**
 * @file MessageProcessor.ts
 * @description Coordinates the message handling flow for the Discord bot.
 * Manages the complete process from receiving a message to sending a response,
 * including validation, context building, and response handling.
 */
import { Message } from 'discord.js';
import { OpenAIService } from './openaiService.js';
import { Planner } from './prompting/Planner.js';
/**
 * Configuration object for initializing MessageProcessor.
 * @typedef {Object} MessageProcessorOptions
 * @property {OpenAIService} openaiService - The service for generating AI responses
 * @property {Planner} [planner] - The planner for generating response plans
 * @property {string} [systemPrompt] - Optional custom system prompt
 */
type MessageProcessorOptions = {
    openaiService: OpenAIService;
    planner?: Planner;
    systemPrompt?: string;
};
/**
 * Handles the complete message processing pipeline for the Discord bot.
 * Coordinates validation, context building, AI response generation, and response handling.
 * @class MessageProcessor
 */
export declare class MessageProcessor {
    private readonly systemPrompt;
    private readonly openaiService;
    private readonly planner;
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
     * Builds the context for an AI response based on the message.
     * @private
     * @param {Message} message - The Discord message
     * @returns {Promise<MessageContext>} The constructed message context and options
     */
    private buildMessageContext;
    /**
     * Handles the response by sending it through the response handler
     * @private
     * @param {ResponseHandler} responseHandler - The response handler to use
     * @param {string} response - The AI-generated response
     * @returns {Promise<void>}
     */
    private handleResponse;
    /**
     * Checks all applicable rate limits for a message in parallel.
     * @private
     * @param {Message} message - The Discord message
     * @returns {Promise<{allowed: boolean, error?: string}>} Rate limit check result
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
