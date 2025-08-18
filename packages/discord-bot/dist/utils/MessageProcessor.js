/**
 * @file MessageProcessor.ts
 * @description Coordinates the message handling flow for the Discord bot.
 * Manages the complete process from receiving a message to sending a response,
 * including validation, context building, and response handling.
 */
import { logger } from './logger.js';
import { ResponseHandler } from './response/ResponseHandler.js';
import { RateLimiter } from './RateLimiter.js';
import { config } from './env.js';
/**
 * Handles the complete message processing pipeline for the Discord bot.
 * Coordinates validation, context building, AI response generation, and response handling.
 * @class MessageProcessor
 */
export class MessageProcessor {
    promptBuilder;
    openaiService;
    rateLimiters;
    /**
     * Creates an instance of MessageProcessor.
     * @param {MessageProcessorOptions} options - Configuration options
     */
    constructor(options) {
        this.promptBuilder = options.promptBuilder;
        this.openaiService = options.openaiService;
        // Initialize rate limiters from config
        this.rateLimiters = {};
        if (config.rateLimits.user.enabled) {
            this.rateLimiters.user = new RateLimiter({
                limit: config.rateLimits.user.limit,
                window: config.rateLimits.user.windowMs,
                scope: 'user',
                errorMessage: 'You are sending messages too quickly. Please slow down.'
            });
        }
        if (config.rateLimits.channel.enabled) {
            this.rateLimiters.channel = new RateLimiter({
                limit: config.rateLimits.channel.limit,
                window: config.rateLimits.channel.windowMs,
                scope: 'channel',
                errorMessage: 'Hit the rate limit for this channel. Please try again later.'
            });
        }
        if (config.rateLimits.guild.enabled) {
            this.rateLimiters.guild = new RateLimiter({
                limit: config.rateLimits.guild.limit,
                window: config.rateLimits.guild.windowMs,
                scope: 'guild',
                errorMessage: 'Hit the rate limit for this server/guild. Please try again later.'
            });
        }
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
            // 2. Check rate limits
            const rateLimitResult = await this.checkRateLimits(message);
            if (!rateLimitResult.allowed) {
                await responseHandler.sendMessage(rateLimitResult.error || 'Rate limit exceeded. Please try again later.');
                return;
            }
            // 3. Show typing indicator
            await responseHandler.indicateTyping();
            // 4. Build context and get AI response
            const { context, options } = await this.buildMessageContext(message);
            const response = await this.openaiService.generateResponse(context, 'gpt-5-mini', {
                reasoningEffort: options.reasoningEffort,
                verbosity: options.verbosity,
                instructions: options.instructions
            });
            // 5. Handle the response
            if (response) {
                // Add the assistant's response to the context for future reference
                context.push({
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                });
                await this.handleResponse(responseHandler, response, context, options);
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
     * @returns {Promise<{context: any[], options: BuildPromptOptions}>} The constructed message context and options
     */
    async buildMessageContext(message) {
        return this.promptBuilder.buildContext(message, {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channelId,
            guildId: message.guildId,
        }, {
        // You can override default GPT-5 options here if needed
        // For example, to set higher verbosity for certain channels or users
        });
    }
    /**
     * Handles the AI response, including formatting and chunking if needed.
     * @private
     * @param {ResponseHandler} responseHandler - The response handler for sending messages
     * @param {string} response - The AI-generated response
     * @param {any[]} context - The context used for the AI response
     * @param {BuildPromptOptions} options - The options used for the AI response
     * @returns {Promise<void>}
     */
    async handleResponse(responseHandler, response, context, options = {}) {
        try {
            const files = [];
            // Prepare debug context as an attachment if in development mode
            if (process.env.NODE_ENV === 'development' && context?.length > 0) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `context-${timestamp}.txt`;
                // Format each message in the context
                const formattedContext = [
                    `[OPTS] ${JSON.stringify(options, null, 2)}`,
                    ...context.map(msg => {
                        const maxLength = 4000; // Discord's message limit is 4000 characters
                        let content = msg.content;
                        if (content.length > maxLength) {
                            content = content.substring(0, maxLength) + '... [truncated]';
                        }
                        // Get first 4 characters of role in uppercase
                        const rolePrefix = msg.role.toUpperCase().substring(0, 4);
                        // Format as [ROLE] content with newlines preserved
                        return `[${rolePrefix}] ${content.replace(/\n/g, '\\n')}`;
                    })
                ].join('\n\n');
                files.push({
                    filename,
                    data: formattedContext
                });
            }
            // Handle the response
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
                await responseHandler.sendMessage(response, files);
            }
        }
        catch (error) {
            logger.error('Error in handleResponse:', error);
            await responseHandler.sendText('An error occurred while processing your response.');
        }
    }
    /**
     * Checks all applicable rate limits for a message.
     * @private
     * @param {Message} message - The Discord message
     * @returns {{allowed: boolean, error?: string}} Rate limit check result
     */
    async checkRateLimits(message) {
        // Check user rate limit
        if (this.rateLimiters.user) {
            const userLimit = this.rateLimiters.user.check(message.author.id, message.channel.id, message.guild?.id);
            if (!userLimit.allowed) {
                return userLimit;
            }
        }
        // Check channel rate limit
        if (this.rateLimiters.channel) {
            const channelLimit = this.rateLimiters.channel.check(message.author.id, message.channel.id, message.guild?.id);
            if (!channelLimit.allowed) {
                return channelLimit;
            }
        }
        // Check guild rate limit (if in a guild)
        if (this.rateLimiters.guild && message.guild) {
            const guildLimit = this.rateLimiters.guild.check(message.author.id, message.channel.id, message.guild.id);
            if (!guildLimit.allowed) {
                return guildLimit;
            }
        }
        return { allowed: true };
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