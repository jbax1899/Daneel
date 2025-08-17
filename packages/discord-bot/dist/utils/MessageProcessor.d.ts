/**
 * MessageProcessor - Coordinates the message handling flow
 * Manages the process from receiving a message to sending a response
 */
import type { Message } from 'discord.js';
import { DiscordPromptBuilder } from './prompting/PromptBuilder.js';
import { OpenAIService } from './openaiService.js';
export interface IMessageProcessor {
    processMessage(message: Message): Promise<void>;
}
export interface MessageProcessorDependencies {
    promptBuilder: DiscordPromptBuilder;
    openaiService: OpenAIService;
}
export declare class MessageProcessor implements IMessageProcessor {
    private readonly promptBuilder;
    private readonly openaiService;
    constructor(dependencies: MessageProcessorDependencies);
    processMessage(message: Message): Promise<void>;
    private isValidMessage;
    private buildMessageContext;
    private handleResponse;
    private handleError;
}
