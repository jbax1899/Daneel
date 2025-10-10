import { Message } from 'discord.js';
import { OpenAIMessage, OpenAIService } from '../openaiService.js';
export declare const isFullContextLoggingEnabled: () => boolean;
export declare const logContextIfVerbose: (context: OpenAIMessage[]) => void;
export declare class ContextBuilder {
    private readonly openaiService;
    private readonly DEFAULT_CONTEXT_MESSAGES;
    private readonly DEFAULT_SYSTEM_PROMPT;
    constructor(openaiService: OpenAIService);
    /**
     * Builds the message context for the given message
     * @param {Message} message - The message to build the context for
     * @returns {Promise<{ context: OpenAIMessage[] }>} The message context
     */
    buildMessageContext(message: Message, maxMessages?: number): Promise<{
        context: OpenAIMessage[];
    }>;
}
