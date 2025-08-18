/**
 * @file PromptBuilder.ts
 * @description Handles building conversation contexts for AI interactions in Discord.
 * Manages message history, system prompts, and context construction for AI model interactions.
 */
import { Message } from 'discord.js';
/**
 * Represents the role of a message in the conversation context.
 * @typedef {'user' | 'assistant' | 'system' | 'developer'} MessageRole
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'developer';
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
type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
type VerbosityLevel = 'low' | 'medium' | 'high';
/**
 * Options for generating a response with GPT-5
 * @interface GenerateResponseOptions
 */
export interface GenerateResponseOptions {
    reasoningEffort?: ReasoningEffort;
    verbosity?: VerbosityLevel;
    instructions?: string;
}
/**
 * Options for building a prompt with GPT-5 specific settings
 * @interface BuildPromptOptions
 * @extends {GenerateResponseOptions}
 */
export interface BuildPromptOptions extends GenerateResponseOptions {
}
/**
 * Configuration options for the PromptBuilder.
 * @interface PromptBuilderOptions
 * @property {number} [maxContextMessages=10] - Maximum number of messages to include in the context
 * @property {string} [systemPrompt] - Custom system prompt to use for the conversation
 * @property {ReasoningEffort} [defaultReasoningEffort] - Default reasoning effort for GPT-5
 * @property {VerbosityLevel} [defaultVerbosity] - Default verbosity level for GPT-5 responses
 */
export interface PromptBuilderOptions {
    maxContextMessages?: number;
    systemPrompt?: string;
    defaultReasoningEffort?: ReasoningEffort;
    defaultVerbosity?: VerbosityLevel;
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
     * Formats a message for the AI context
     * @private
     * @param {Message} msg - The message to format
     * @param {string} botUserId - The bot's user ID
     * @returns {{role: MessageRole, content: string}} Formatted message context
     */
    private formatMessage;
    /**
     * Builds a conversation context from a Discord message with GPT-5 specific options.
     * @param {Message} message - The Discord message to build context from
     * @param {Record<string, any>} [additionalContext={}] - Optional additional context to include
     * @param {BuildPromptOptions} [options] - GPT-5 specific options
     * @returns {Promise<{context: MessageContext[], options: BuildPromptOptions}>} The constructed message context and options
     */
    buildContext(message: Message, additionalContext?: Record<string, any>, options?: BuildPromptOptions): Promise<{
        context: MessageContext[];
        options: BuildPromptOptions;
    }>;
}
export {};
