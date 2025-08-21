import { Message } from 'discord.js';
import { OpenAIService } from './OpenAIService';
import { Planner } from './prompting/Planner';
type MessageProcessorOptions = {
    openaiService: OpenAIService;
    planner?: Planner;
    systemPrompt?: string;
};
export declare class MessageProcessor {
    private readonly systemPrompt;
    private readonly openaiService;
    private readonly planner;
    private readonly rateLimiters;
    constructor(options: MessageProcessorOptions);
    processMessage(message: Message): Promise<void>;
    private buildMessageContext;
    private checkRateLimits;
}
export {};
