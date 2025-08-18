/**
 * @file openaiService.ts
 * @description Service for interacting with the OpenAI API to generate AI responses.
 * Handles message formatting and API communication with OpenAI's chat completions.
 */
/**
 * Represents a message in a conversation with the AI
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role - The role of the message sender
 * @property {string} content - The content of the message
 */
type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};
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
     * @param {string} [model='gpt-4.1-mini'] - The OpenAI model to use for generation
     * @param {number} [maxTokens=500] - Maximum number of tokens to generate
     * @returns {Promise<string|null>} The generated response or null if no response
     * @throws {Error} If there's an error communicating with the OpenAI API
     */
    generateResponse(messages: Message[], model?: string, maxTokens?: number): Promise<string | null>;
    /**
     * Creates a user message object
     * @param {string} content - The message content
     * @returns {Message} Formatted user message object
     */
    createUserMessage(content: string): Message;
    /**
     * Creates an assistant message object
     * @param {string} content - The message content
     * @returns {Message} Formatted assistant message object
     */
    createAssistantMessage(content: string): Message;
    /**
     * Creates a system message object
     * @param {string} content - The message content
     * @returns {Message} Formatted system message object
     */
    createSystemMessage(content: string): Message;
}
export {};
