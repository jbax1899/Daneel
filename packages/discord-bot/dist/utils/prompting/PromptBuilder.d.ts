/**
 * PromptBuilder - Handles building conversation contexts for AI interactions
 * Will contain logic to construct prompts based on message history and context
 */
import { Message } from 'discord.js';
export type MessageRole = 'user' | 'assistant' | 'system';
export interface MessageContext {
    role: MessageRole;
    content: string;
    timestamp?: number;
}
export interface PromptBuilderOptions {
    maxContextMessages?: number;
    systemPrompt?: string;
}
export interface IPromptBuilder {
    /**
     * Builds a conversation context from a Discord message
     * @param message The Discord message to build context from
     * @param additionalContext Optional additional context to include
     */
    buildContext(message: Message, additionalContext?: Record<string, any>): Promise<MessageContext[]>;
    getSystemPrompt(): string;
}
export declare class DiscordPromptBuilder implements IPromptBuilder {
    private readonly options;
    constructor(options?: PromptBuilderOptions);
    buildContext(message: Message, additionalContext?: Record<string, any>): Promise<MessageContext[]>;
    getSystemPrompt(): string;
}
