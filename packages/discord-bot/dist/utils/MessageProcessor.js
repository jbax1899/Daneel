/**
 * MessageProcessor - Coordinates the message handling flow
 * Manages the process from receiving a message to sending a response
 */
import { logger } from './logger.js';
import { ResponseHandler } from './response/ResponseHandler.js';
export class MessageProcessor {
    promptBuilder;
    openaiService;
    constructor(dependencies) {
        this.promptBuilder = dependencies.promptBuilder;
        this.openaiService = dependencies.openaiService;
    }
    async processMessage(message) {
        const responseHandler = new ResponseHandler(message, message.channel, message.author);
        try {
            // 1. Validate message
            if (!this.isValidMessage(message)) {
                return;
            }
            // 2. Show typing indicator
            await responseHandler.indicateTyping(5000);
            // 3. Build context and get AI response
            const context = await this.buildMessageContext(message);
            const response = await this.openaiService.generateResponse(context);
            // 4. Handle the response
            if (response) {
                await this.handleResponse(responseHandler, response, context);
            }
        }
        catch (error) {
            logger.error('Error processing message:', error);
            await this.handleError(responseHandler, error);
        }
    }
    isValidMessage(message) {
        return !message.author.bot && message.content.trim().length > 0;
    }
    async buildMessageContext(message) {
        return this.promptBuilder.buildContext(message, {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channelId,
            guildId: message.guildId,
        });
    }
    async handleResponse(responseHandler, response, context) {
        let finalResponse = response;
        // In development, prepend the context if available
        if (process.env.NODE_ENV === 'development' && context) {
            const contextString = context.map(c => typeof c === 'string' ? c : JSON.stringify(c, null, 2)).join('\n\n---\n\n');
            finalResponse = `Full context:\n\`\`\`\n${contextString}\n\`\`\`\n\n${response}`;
        }
        // Handle long messages by splitting them into chunks
        if (finalResponse.length > 2000) {
            const chunks = finalResponse.match(/[\s\S]{1,2000}/g) || [];
            for (const chunk of chunks) {
                await responseHandler.sendText(chunk);
            }
        }
        else {
            await responseHandler.sendText(finalResponse);
        }
    }
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