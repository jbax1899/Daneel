/**
 * @file openaiService.ts
 * @description Service for interacting with the OpenAI API to generate AI responses.
 * Handles message formatting and API communication with OpenAI's Responses API.
 */
/**
 * Represents a message in a conversation with the AI
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'|'developer'} role - The role of the message sender
 * @property {string} content - The content of the message
 */
type Message = {
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: string;
};
type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
type VerbosityLevel = 'low' | 'medium' | 'high';
export interface GenerateResponseOptions {
    reasoningEffort?: ReasoningEffort;
    verbosity?: VerbosityLevel;
    instructions?: string;
}
/**
 * Service for interacting with the OpenAI API
 * @class OpenAIService
 */
export declare class OpenAIService {
    /** OpenAI client instance */
    private openai;
    /**
     * Creates an instance of OpenAIService
     * @param {string} apiKey - OpenAI API key for authentication
     */
    constructor(apiKey: string);
    /**
     * Generates a response from the OpenAI API based on the provided messages
     * @async
     * @param {Message[]} messages - Array of message objects for the conversation context
     * @param {string} [model='gpt-5-mini'] - The OpenAI model to use for generation
     * @param {GenerateResponseOptions} [options] - Additional options for the generation
     * @returns {Promise<string|null>} The generated response or null if no response
     * @throws {Error} If there's an error communicating with the OpenAI API
     */
    generateResponse(messages: Message[], model?: string, options?: GenerateResponseOptions): Promise<string | null>;
}
export {};
