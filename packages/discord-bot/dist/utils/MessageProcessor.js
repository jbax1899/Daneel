/**
 * @file MessageProcessor.ts
 * @description Coordinates the message handling flow for the Discord bot.
 * Manages the complete process from receiving a message to sending a response,
 * including validation, context building, and response handling.
 */
import { logger } from './logger.js';
import { ResponseHandler } from './response/ResponseHandler.js';
/**
 * Handles the complete message processing pipeline for the Discord bot.
 * Coordinates validation, context building, AI response generation, and response handling.
 * @class MessageProcessor
 */
export class MessageProcessor {
    promptBuilder;
    openaiService;
    /**
     * Creates an instance of MessageProcessor.
     * @param {MessageProcessorOptions} options - Configuration options
     */
    constructor(options) {
        this.promptBuilder = options.promptBuilder;
        this.openaiService = options.openaiService;
    }
    /**
     * Processes an incoming Discord message.
     * @param {Message} message - The Discord message to process
     * @returns {Promise<void>}
     */
    async processMessage(message) {
        const responseHandler = new ResponseHandler(message, message.channel, message.author);
        try {
            // 1. Validate message
            if (!this.isValidMessage(message)) {
                return;
            }
            // 2. Show typing indicator
            await responseHandler.indicateTyping();
            // 3. Build context and get AI response
            const context = await this.buildMessageContext(message);
            const response = await this.openaiService.generateResponse(context);
            // 4. Handle the response
            if (response) {
                // Add the assistant's response to the context for future reference
                context.push({
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                });
                await this.handleResponse(responseHandler, response, context);
            }
        }
        catch (error) {
            logger.error('Error processing message:', error);
            await this.handleError(responseHandler, error);
        }
    }
    /**
     * Validates if a message should be processed.
     * @private
     * @param {Message} message - The message to validate
     * @returns {boolean} True if the message is valid, false otherwise
     */
    isValidMessage(message) {
        return !message.author.bot && message.content.trim().length > 0;
    }
    /**
     * Builds the context for an AI response based on the message.
     * @private
     * @param {Message} message - The Discord message
     * @returns {Promise<any[]>} The constructed message context
     */
    async buildMessageContext(message) {
        return this.promptBuilder.buildContext(message, {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channelId,
            guildId: message.guildId,
        });
    }
    /**
     * Handles the AI response, including formatting and chunking if needed.
     * @private
     * @param {ResponseHandler} responseHandler - The response handler for sending messages
     * @param {string} response - The AI-generated response
     * @param {any[]} context - The context used for the AI response
     * @returns {Promise<void>}
     */
    async handleResponse(responseHandler, response, context) {
        try {
            // Prepare debug context as an attachment if in development mode
            const files = [];
            if (process.env.NODE_ENV === 'development' && context?.length > 0) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `context-${timestamp}.json`;
                const contextData = JSON.stringify(context, null, 2);
                files.push({
                    filename,
                    data: contextData
                });
            }
            // Handle the response with optional debug context attachment
            if (response.length > 2000) {
                // For long responses, split into chunks and attach context to the first chunk
                const chunks = response.match(/[\s\S]{1,2000}/g) || [];
                // Send first chunk with debug context if any
                if (chunks.length > 0) {
                    await responseHandler.sendMessage(chunks[0], files);
                    // Send remaining chunks without debug context
                    for (let i = 1; i < chunks.length; i++) {
                        await responseHandler.sendText(chunks[i]);
                    }
                }
            }
            else {
                // Single message with debug context if any
                await responseHandler.sendMessage(response, files);
            }
        }
        catch (error) {
            logger.error('Error in handleResponse:', error);
            await responseHandler.sendText('An error occurred while processing your response.');
        }
    }
    /**
     * Handles errors that occur during message processing.
     * @private
     * @param {ResponseHandler} responseHandler - The response handler for error messages
     * @param {unknown} error - The error that occurred
     * @returns {Promise<void>}
     */
    async handleError(responseHandler, error) {
        logger.error('Error in MessageProcessor:', error);
        try {
            await responseHandler.sendText('Sorry, I encountered an error processing your message.');
        }
        catch (replyError) {
            logger.error('Failed to send error reply:', replyError);
        }
    }
}
//# sourceMappingURL=MessageProcessor.js.map