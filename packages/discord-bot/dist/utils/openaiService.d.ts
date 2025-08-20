/**
 * @file openaiService.ts
 * @description Service for interacting with the OpenAI API to generate AI responses.
 * Handles message formatting and API communication with OpenAI's Responses API.
 */
type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
type VerbosityLevel = 'low' | 'medium' | 'high';
/**
 * Represents a single message in the conversation context for OpenAI
 */
export interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: string;
}
/**
 * Options for generating a response with the OpenAI API
 */
export interface OpenAIOptions {
    /** Controls the depth of reasoning (more reasoning = better quality but slower) */
    reasoningEffort?: ReasoningEffort;
    /** Controls the verbosity of the response */
    verbosity?: VerbosityLevel;
}
export interface OpenAIResponse {
    response: string | null;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        cost: string;
    };
    debugContext?: {
        filename: string;
        content: string;
    };
}
/**
 * Service for interacting with the OpenAI API
 * @class OpenAIService
 */
export declare class OpenAIService {
    private openai;
    /**
     * Creates an instance of OpenAIService
     * @param {string} apiKey - OpenAI API key for authentication
     */
    constructor(apiKey: string);
    /**
     * Generates a response from the OpenAI API based on the provided messages
     * @async
     * @param {OpenAIMessage[]} messages - Array of message objects for the conversation context
     * @param {string} [model='gpt-5-mini'] - The OpenAI model to use for generation
     * @param {OpenAIOptions} [options] - Additional options for the generation
     * @returns {Promise<OpenAIResponse>} The generated response and token usage data
     * @throws {Error} If there's an error communicating with the OpenAI API
     */
    generateResponse(messages: OpenAIMessage[], model?: string, options?: OpenAIOptions): Promise<OpenAIResponse>;
    /**
     * Calculate the estimated cost for a given model and token usage
     * @private
     * @param {string} model - The model used
     * @param {number} promptTokens - Number of tokens in the prompt
     * @param {number} completionTokens - Number of tokens in the completion
     * @returns {string} Formatted cost string or 'N/A' if model pricing is unknown
     */
    private calculateCost;
    /**
     * Generates debug context for development purposes
     * @private
     * @param {OpenAIMessage[]} messages - The messages sent to the API
     * @param {OpenAIOptions} options - The options used for the API call
     * @param {Object} usage - Token usage information
     * @param {number} usage.input_tokens - Number of input tokens
     * @param {number} usage.output_tokens - Number of output tokens
     * @param {number} usage.total_tokens - Total number of tokens
     * @param {string} usage.cost - Estimated cost of the API call
     * @returns {{filename: string, content: string}} Debug context with filename and content
     */
    private generateDebugContext;
}
export {};
