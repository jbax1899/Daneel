/**
 * @file openaiService.ts
 * @description Service for interacting with the OpenAI API to generate AI responses.
 * Handles message formatting and API communication with OpenAI's Responses API.
 */
import OpenAI from 'openai';
import { logger } from './logger.js';
/**
 * Service for interacting with the OpenAI API
 * @class OpenAIService
 */
export class OpenAIService {
    openai; // OpenAI client instance
    /**
     * Creates an instance of OpenAIService
     * @param {string} apiKey - OpenAI API key for authentication
     */
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
    }
    /**
     * Generates a response from the OpenAI API based on the provided messages
     * @async
     * @param {Message[]} messages - Array of message objects for the conversation context
     * @param {string} [model='gpt-5-mini'] - The OpenAI model to use for generation
     * @param {GenerateResponseOptions} [options] - Additional options for the generation
     * @returns {Promise<string|null>} The generated response or null if no response
     * @throws {Error} If there's an error communicating with the OpenAI API
     */
    async generateResponse(messages, model = 'gpt-5-mini', options = {}) {
        try {
            logger.debug('Sending request to OpenAI');
            const { reasoningEffort, verbosity, instructions } = options;
            const response = await this.openai.responses.create({
                model,
                input: messages,
                ...(instructions && { instructions }),
                ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
                ...(verbosity && { text: { verbosity } })
            });
            // Log token usage if available
            if (response.usage) {
                const prompt_tokens = response.usage.input_tokens ?? 0;
                const completion_tokens = response.usage.output_tokens ?? 0;
                const total_tokens = response.usage.total_tokens ?? 0;
                logger.debug('Token usage:', {
                    model,
                    prompt_tokens,
                    completion_tokens,
                    total_tokens,
                    cost: this.calculateCost(model, prompt_tokens, completion_tokens)
                });
            }
            return response.output_text || null;
        }
        catch (error) {
            logger.error('Error in OpenAI service:', error);
            throw error;
        }
    }
    /**
     * Calculate the estimated cost for a given model and token usage
     * @private
     * @param {string} model - The model used
     * @param {number} promptTokens - Number of tokens in the prompt
     * @param {number} completionTokens - Number of tokens in the completion
     * @returns {string} Formatted cost string or 'N/A' if model pricing is unknown
     */
    calculateCost(model, promptTokens, completionTokens) {
        // Token prices per 1M tokens (in USD)
        // https://platform.openai.com/docs/pricing
        // Updated 2025-08-18
        const PRICING = {
            'gpt-5-mini': { prompt: 0.25, completion: 2.00 },
        };
        const modelPricing = Object.entries(PRICING).find(([key]) => model.toLowerCase().includes(key))?.[1];
        if (!modelPricing)
            return 'N/A';
        const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
        const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;
        const totalCost = promptCost + completionCost;
        return `$${totalCost.toFixed(6)}`;
    }
}
//# sourceMappingURL=openaiService.js.map