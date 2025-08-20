/**
 * @file openaiService.ts
 * @description Service for interacting with the OpenAI API to generate AI responses.
 * Handles message formatting and API communication with OpenAI's Responses API.
 */

import OpenAI from 'openai';
import { logger } from './logger.js';

const DEFAULT_MODEL = 'gpt-5-mini';

type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
type VerbosityLevel = 'low' | 'medium' | 'high';

/**
 * Represents a single message in the conversation context for OpenAI
 */
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string
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
   * @param {OpenAIMessage[]} messages - Array of message objects for the conversation context
   * @param {string} [model='gpt-5-mini'] - The OpenAI model to use for generation
   * @param {OpenAIOptions} [options] - Additional options for the generation
   * @returns {Promise<OpenAIResponse>} The generated response and token usage data
   * @throws {Error} If there's an error communicating with the OpenAI API
   */
  async generateResponse(
    messages: OpenAIMessage[],
    model: string = DEFAULT_MODEL,
    options: OpenAIOptions = {}
  ): Promise<OpenAIResponse> {
    try {
      logger.debug('Requesting response from OpenAI...');
      
      const { reasoningEffort = 'minimal', verbosity = 'low' } = options;
      
      const response = await this.openai.responses.create({
        model,
        input: messages,
        ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
        ...(verbosity ? { 
          text: { 
            ...(verbosity && { verbosity })
          } 
        } : {}),
      });

      let result: OpenAIResponse = {
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
      }

      // Add debug context if in development mode
      if (process.env.NODE_ENV === 'development') {
        result.debugContext = this.generateDebugContext(
          messages,
          options,
          {
            input_tokens: response.usage?.input_tokens || 0,
            output_tokens: response.usage?.output_tokens || 0,
            total_tokens: response.usage?.total_tokens || 0,
            cost: this.calculateCost(model, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0)
          }
        );
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
      'gpt-5-nano': { prompt: 0.05, completion: 0.40 },
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
  private generateDebugContext(
    messages: OpenAIMessage[],
    options: OpenAIOptions,
    usage: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cost: string;
    }
  ): { filename: string; content: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `context-${timestamp}.txt`;
    
    const content = [
      // Options
      `[OPTS] ${Object.entries(options)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')}`,
      
      // Token usage information
      `[USAGE] tokens: ${usage.input_tokens} in | ${usage.output_tokens} out | ${usage.total_tokens} total | Cost: ${usage.cost}`,
      
      // Messages
      ...messages.map(msg => {
        const rolePrefix = msg.role.toUpperCase().substring(0, 4);
        const content = msg.content.replace(/\n/g, '\\n');
        return `[${rolePrefix}] ${content}`;
      })
    ].join('\n\n');

    return { filename, content };
  }
}