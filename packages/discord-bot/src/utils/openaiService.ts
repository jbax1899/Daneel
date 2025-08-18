/**
 * @file openaiService.ts
 * @description Service for interacting with the OpenAI API to generate AI responses.
 * Handles message formatting and API communication with OpenAI's Responses API.
 */

import OpenAI from 'openai';
import { logger } from './logger.js';

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
  reasoningEffort?: ReasoningEffort; // Controls the depth of reasoning (more reasoning = better quality but slower)
  verbosity?: VerbosityLevel; // Controls the verbosity of the response
  instructions?: string; // System instructions for the model
}

export interface GenerateResponseResult {
  response: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: string;
  };
}

/**
 * Service for interacting with the OpenAI API
 * @class OpenAIService
 */
export class OpenAIService {
  private openai: OpenAI; // OpenAI client instance

  /**
   * Creates an instance of OpenAIService
   * @param {string} apiKey - OpenAI API key for authentication
   */
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generates a response from the OpenAI API based on the provided messages
   * @async
   * @param {Message[]} messages - Array of message objects for the conversation context
   * @param {string} [model='gpt-5-mini'] - The OpenAI model to use for generation
   * @param {GenerateResponseOptions} [options] - Additional options for the generation
   * @returns {Promise<GenerateResponseResult>} The generated response and token usage data
   * @throws {Error} If there's an error communicating with the OpenAI API
   */
  async generateResponse(
    messages: Message[],
    model: string = 'gpt-5-mini',
    options: GenerateResponseOptions = {}
  ): Promise<GenerateResponseResult> {
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

      let result: GenerateResponseResult = {
        response: response.output_text || null
      };

      // Add token usage if available
      if (response.usage) {
        const { input_tokens = 0, output_tokens = 0, total_tokens = 0 } = response.usage;
        const cost = this.calculateCost(model, input_tokens, output_tokens);
        
        result.usage = {
          input_tokens,
          output_tokens,
          total_tokens,
          cost
        };

        logger.debug(`Token usage: ${JSON.stringify(result.usage, null, 2)}`);
      }

      return result;
    } catch (error) {
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
  private calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): string {
    // Token prices per 1M tokens (in USD)
    // https://platform.openai.com/docs/pricing
    // Updated 2025-08-18
    const PRICING: Record<string, { prompt: number; completion: number }> = {
      'gpt-5-mini': { prompt: 0.25, completion: 2.00 },
    };

    const modelPricing = Object.entries(PRICING).find(([key]) => 
      model.toLowerCase().includes(key)
    )?.[1];

    if (!modelPricing) return 'N/A';

    const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;
    const totalCost = promptCost + completionCost;

    return `$${totalCost.toFixed(6)}`;
  }
}
