/**
 * @file PromptBuilder.ts
 * @description Handles building conversation contexts for AI interactions in Discord.
 * Manages message history, system prompts, and context construction for AI model interactions.
 */
import { Message } from 'discord.js';
/**
 * Represents the role of a message in the conversation context.
 * @typedef {'user' | 'assistant' | 'system'} MessageRole
 */
export type MessageRole = 'user' | 'assistant' | 'system';
/**
 * Represents a single message in the conversation context.
 * @interface MessageContext
 * @property {MessageRole} role - The role of the message sender
 * @property {string} content - The content of the message
 * @property {number} [timestamp] - Optional timestamp of when the message was sent
 */
export interface MessageContext {
    role: MessageRole;
    content: string;
    timestamp?: number;
}
/**
 * Configuration options for the PromptBuilder.
 * @interface PromptBuilderOptions
 * @property {number} [maxContextMessages=10] - Maximum number of messages to include in the context
 * @property {string} [systemPrompt] - Custom system prompt to use for the conversation
 */
export interface PromptBuilderOptions {
    maxContextMessages?: number;
    systemPrompt?: string;
}
/**
 * Handles building conversation contexts for AI model interactions.
 * Manages message history, system prompts, and context construction.
 * @class PromptBuilder
 */
export declare class PromptBuilder {
    private readonly options;
    /**
     * Creates an instance of PromptBuilder.
     * @param {PromptBuilderOptions} [options={}] - Configuration options
     */
    constructor(options?: PromptBuilderOptions);
    /**
     * Gets the current system prompt being used.
     * @returns {string} The current system prompt
     */
    getSystemPrompt(): string;
    /**
     * Builds a conversation context from a Discord message.
     * @param {Message} message - The Discord message to build context from
     * @param {Record<string, any>} [additionalContext={}] - Optional additional context to include
     * @returns {Promise<MessageContext[]>} Array of message contexts for the AI model
     */
    buildContext(message: Message, additionalContext?: Record<string, any>): Promise<MessageContext[]>;
}
