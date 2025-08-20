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
import { Planner } from './prompting/Planner.js';
/**
 * Default system prompt used when no custom prompt is provided.
 * @constant
 * @type {string}
 */
const DEFAULT_SYSTEM_PROMPT = `You are Daneel, modeled after R. Daneel Olivaw from Asimov's Robot novels.
Speak in similar style to this character from the source writing.
Act like any other user in this Discord server - Be helpful, but not overly so. 
Do not end your messages with chatbot-style questions like "Is there anything else I can help you with?"`;
/**
 * Handles the complete message processing pipeline for the Discord bot.
 * Coordinates validation, context building, AI response generation, and response handling.
 * @class MessageProcessor
 */
export class MessageProcessor {
    systemPrompt;
    openaiService;
    planner;
    rateLimiters;
    /**
     * Creates an instance of MessageProcessor.
     * @param {MessageProcessorOptions} options - Configuration options
     */
    constructor(options) {
        this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        this.openaiService = options.openaiService;
        this.planner = options.planner || new Planner(this.openaiService);
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
            // Input validation
            if (!message?.content?.trim()) {
                logger.warn('Received empty message', { messageId: message.id });
                return;
            }
            // Check rate limits
            try {
                const rateLimitResult = await this.checkRateLimits(message);
                if (!rateLimitResult.allowed) {
                    if (rateLimitResult.error) {
                        await responseHandler.sendMessage(rateLimitResult.error);
                    }
                    return;
                }
            }
            catch (error) {
                logger.error('Error checking rate limits:', error); // Continue processing even if rate limit check fails
            }
            // Show typing indicator
            try {
                await responseHandler.indicateTyping();
            }
            catch (typingError) {
                logger.warn('Failed to send typing indicator:', typingError); // Continue processing even if typing indicator fails
            }
            // Build message context
            let context;
            try {
                const result = await this.buildMessageContext(message);
                context = result.context;
            }
            catch (contextError) {
                throw Error("Error building message context: " + contextError);
            }
            // Generate plan
            let plan;
            try {
                plan = await this.planner.generatePlan(message, context);
                if (!plan) {
                    throw new Error('Failed to generate plan');
                }
            }
            catch (planError) {
                throw Error("Error generating plan: " + planError);
            }
            // Handle different response types based on the plan
            switch (plan.action) {
                case 'noop':
                    return;
                case 'reply':
                case 'dm':
                    // Get AI response for text-based replies
                    const { response, usage } = await this.openaiService.generateResponse(context, 'gpt-5-mini', {
                        reasoningEffort: plan.openaiOptions?.reasoningEffort,
                        verbosity: plan.openaiOptions?.verbosity
                    });
                    if (response) {
                        logger.debug(`Response recieved. Tokens used: ${usage?.input_tokens} in | ${usage?.output_tokens} out | ${usage?.total_tokens} total | Cost: ${usage?.cost}`);
                        // Update context with assistant's response
                        context.push({
                            role: 'assistant',
                            content: response,
                        });
                        // Handle the response
                        await this.handleResponse(responseHandler, response);
                    }
                    break;
                case 'react':
                    if (plan.reaction) {
                        try {
                            logger.debug(`Reacting to message with emoji: ${plan.reaction}`);
                            await responseHandler.addReaction(plan.reaction);
                        }
                        catch (error) {
                            logger.error('Failed to react with emoji:', error);
                        }
                    }
                    break;
                default:
                    // No operation needed
                    break;
            }
        }
        catch (error) {
            await this.handleError(responseHandler, error);
        }
    }
    /**
     * Builds the context for an AI response based on the message.
     * @private
     * @param {Message} message - The Discord message
     * @returns {Promise<MessageContext>} The constructed message context and options
     */
    async buildMessageContext(message) {
        const context = [
            {
                role: 'system',
                content: this.systemPrompt
            }
        ];
        // Add message history
        const messages = await message.channel.messages.fetch({
            limit: 10, // Default limit, can be made configurable
            before: message.id,
        });
        const messageHistory = Array.from(messages.values())
            .reverse()
            .filter(msg => msg.content.trim().length > 0)
            .map(msg => ({
            role: 'user', // TODO: correctly discern user, assistant, system, developer
            content: msg.content
        }));
        context.push(...messageHistory);
        // Add current message
        context.push({
            role: 'user',
            content: message.content
        });
        return {
            context,
        };
    }
    /**
     * Handles the response by sending it through the response handler
     * @private
     * @param {ResponseHandler} responseHandler - The response handler to use
     * @param {string} response - The AI-generated response
     * @returns {Promise<void>}
     */
    async handleResponse(responseHandler, response) {
        try {
            // Try to parse the response as JSON to check if it contains an embed
            let parsedResponse;
            let embedData = null;
            try {
                parsedResponse = JSON.parse(response);
                if (parsedResponse.embed) {
                    embedData = parsedResponse.embed;
                }
            }
            catch (e) {
                // Not a JSON response, treat as plain text
            }
            // If we have embed data, create and send the embed
            if (embedData) {
                // TODO: implement embed sending
                await responseHandler.sendMessage(response);
            }
            else if (response) {
                // If no embed, send as regular message
                await responseHandler.sendMessage(response);
            }
        }
        catch (error) {
            logger.error('Error in handleResponse:', error);
            await responseHandler.sendMessage('An error occurred while processing your response.');
        }
    }
    /**
     * Checks all applicable rate limits for a message in parallel.
     * @private
     * @param {Message} message - The Discord message
     * @returns {Promise<{allowed: boolean, error?: string}>} Rate limit check result
     */
    async checkRateLimits(message) {
        const checks = [];
        if (this.rateLimiters.user) {
            checks.push(Promise.resolve(this.rateLimiters.user.check(message.author.id, message.channel.id, message.guild?.id)));
        }
        if (this.rateLimiters.channel) {
            checks.push(Promise.resolve(this.rateLimiters.channel.check(message.author.id, message.channel.id, message.guild?.id)));
        }
        if (this.rateLimiters.guild && message.guild) {
            checks.push(Promise.resolve(this.rateLimiters.guild.check(message.author.id, message.channel.id, message.guild.id)));
        }
        // If no rate limiters are configured, allow the request
        if (checks.length === 0) {
            return { allowed: true };
        }
        try {
            // Execute all rate limit checks in parallel
            const results = await Promise.allSettled(checks);
            // Check for the first rate limit that was hit
            for (const result of results) {
                if (result.status === 'fulfilled' && !result.value.allowed) {
                    return result.value;
                }
            }
            return { allowed: true };
        }
        catch (error) {
            logger.error('Error checking rate limits:', error);
            // Fail open to prevent blocking legitimate requests during errors
            return { allowed: true };
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
            await responseHandler.sendText('Sorry, I failed to think of a response.');
        }
        catch (replyError) {
            logger.error('Failed to send error reply:', replyError);
        }
    }
}
//# sourceMappingURL=MessageProcessor.js.map