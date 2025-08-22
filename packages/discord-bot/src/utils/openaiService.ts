import OpenAI from 'openai';
import { logger } from './logger.js';

// ====================
// Type Declarations
// ====================

export type SupportedModel = GPT5ModelType; 
export type GPT5ModelType = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
}

export interface OpenAIOptions {
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  functions?: Array<{
    name: string;
    description?: string;
    parameters: Record<string, any>;
  }>;
  function_call?: { name: string } | 'auto' | 'none' | 'required' | null;
  tool_choice?: {
    type: 'function';
    function: { name: string };
  } | 'none' | 'auto' | null;
}

export interface OpenAIResponse {
  normalizedText: string | null;
  message: {
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: string;
    function_call?: { name: string; arguments?: string } | null;
  };
  finish_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost?: string;
  };
}

// Extended interface for OpenAI Responses output items
interface ResponseOutputItemExtended {
  type?: string; // "reasoning", "function_call", etc.
  name?: string; // present on type "function_call"
  arguments?: string; // present on type "function_call"
  tool_calls?: Array<{ function: { name: string; arguments?: string } }>;
  function_call?: { name: string; arguments?: string };
  tool?: { name: string; arguments?: string };
  content?: Array<{ type: string; text: string }>;
  finish_reason?: string;
}

// ====================
// Constants
// ====================

const DEFAULT_GPT5_MODEL: SupportedModel = 'gpt-5-mini';
const DEFAULT_MODEL: SupportedModel = DEFAULT_GPT5_MODEL;
const GPT5_PRICING: Record<GPT5ModelType, { input: number; output: number }> = {
  // Pricing per 1M tokens
  // https://platform.openai.com/docs/pricing
  'gpt-5': { input: 1.25, output: 10 },
  'gpt-5-mini': { input: 0.25, output: 2.0 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
};

// ====================
// OpenAI Service Class
// ====================

export class OpenAIService {
  private openai: OpenAI;
  public defaultModel: SupportedModel = DEFAULT_MODEL;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  public async generateResponse(
    model: SupportedModel = this.defaultModel,
    messages: OpenAIMessage[],
    options: OpenAIOptions = {}
  ): Promise<OpenAIResponse> {
    return this.generateGPT5Response(model, messages, options);
  }

  private async generateGPT5Response(
    model: SupportedModel,
    messages: OpenAIMessage[],
    options: OpenAIOptions
  ): Promise<OpenAIResponse> {
    const { reasoningEffort = 'low', verbosity = 'low', functions } = options;

    try {
      // Map messages for the OpenAI Responses API
      const input = messages.map(msg => ({
        role: msg.role,
        content: [{
          type: msg.role === 'assistant' ? 'output_text' : 'input_text' as const,
          text: msg.content
        }]
      }));

      const tools = functions?.map(fn => ({
        type: 'function' as const,
        name: fn.name,
        description: fn.description || '',
        parameters: fn.parameters || {},
        strict: false
      }));

      const requestPayload: any = {
        model,
        input,
        ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
        ...(verbosity && { text: { verbosity } }),
        ...(tools ? { tools } : {}),
        tool_choice: 'auto',  // Let the model pick a tool if needed
      };

      // Generate response
      const response = await this.openai.responses.create(requestPayload);

      //logger.debug(`Raw OpenAI response: ${JSON.stringify(response)}`);

      // Get output items from response
      const outputItems = response.output as ResponseOutputItemExtended[];

      // First try to find a message response
      let outputText = '';
      let finishReason = 'stop';

      for (const item of outputItems ?? []) {
        if (item.type === 'message' && item.content?.[0]?.text) {
          outputText = item.content[0].text;
          finishReason = item.finish_reason ?? finishReason;
          break;
        }
      }

      // Fall back to output_text if no message found
      if (!outputText) {
        const firstTextItem = outputItems.find(
          i => i.type === 'output_text' && i.content?.[0]?.text?.trim()
        );
        outputText = firstTextItem?.content?.[0]?.text ?? '';
        finishReason = firstTextItem?.finish_reason ?? finishReason;
      }

      let parsedFunctionCall: { name: string; arguments: string } | null = null;
      for (const item of outputItems ?? []) {
        if (item.type === 'function_call' && item.name) {
          parsedFunctionCall = { name: item.name, arguments: item.arguments ?? '{}' };
          break;
        }
      }

      return {
        normalizedText: outputText,
        message: {
          role: 'assistant',
          content: outputText,
          function_call: parsedFunctionCall
        },
        finish_reason: finishReason,
        usage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
          total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
          cost: this.calculateCost(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, model)
        }
      };

    } catch (error) {
      logger.error('Error in generateGPT5Response:', error);
      throw error;
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number, model: SupportedModel): string {
    const pricing = GPT5_PRICING[model];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return `$${(inputCost + outputCost).toFixed(6)}`;
  }
}
