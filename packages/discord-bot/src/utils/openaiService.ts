import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { logger } from './logger.js'

// ====================
// Type Declarations
// ====================

export type SupportedModel = GPT5ModelType; 
export type GPT5ModelType = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
export type TTSModel = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
export type TTSVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer';

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
  normalizedText?: string | null;
  message?: {
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: string;
    function_call?: { name: string; arguments?: string } | null;
  };
  finish_reason?: string;
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
// Constants / Variables
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
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '..', 'output');
const TTS_OUTPUT_PATH = path.join(OUTPUT_PATH, 'tts');
const IMAGE_DESCRIPTION_MODEL: SupportedModel = 'gpt-5-mini';

let isDirectoryInitialized = false; // Tracks if output directories have been initialized

// ====================
// OpenAI Service Class
// ====================

export class OpenAIService {
  private openai: OpenAI;
  public defaultModel: SupportedModel = DEFAULT_MODEL;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    ensureDirectories();
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

  public async generateSpeech(
    model: TTSModel,
    voice: TTSVoice,
    input: string, 
    instructions: string, 
    filename: string, 
    format: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm') {
    //https://platform.openai.com/docs/guides/text-to-speech
    if (!filename || !/^[\w\-]+$/.test(filename)) {
      throw new Error('Invalid filename. Only alphanumeric characters, hyphens, and underscores are allowed.');
    }
    
    const outputPath = path.join(TTS_OUTPUT_PATH, `${filename}.${format}`);

    logger.debug(`Generating speech file: ${outputPath}...`);

    try {
      const mp3 = await this.openai.audio.speech.create({
        model: model,
        voice: voice,
        input: input,
        instructions: instructions,
        response_format: format,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.promises.writeFile(outputPath, buffer);
      logger.debug(`Generated speech file: ${outputPath}`);
      return outputPath;
    } catch (error) {
      // Clean up partially written file if it exists
      try {
        if (fs.existsSync(outputPath)) {
          await fs.promises.unlink(outputPath);
        }
      } catch (cleanupError) {
        logger.error('Failed to clean up file after error:', cleanupError);
      }
      throw error;
    }
  }

  public async generateImageDescription(
    imageUrl: string, // URL from Discord attachment
    model: SupportedModel = IMAGE_DESCRIPTION_MODEL,
  ): Promise<OpenAIResponse> {
    try {
      // Download the image from the URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      // Get the image data as a buffer
      const imageBuffer = await response.arrayBuffer();
      
      // Convert the image to base64
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      
      // Get the content type from the response headers or default to jpeg
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      const chatResponse = await this.openai.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: "What's in this image?"
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${contentType};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }]
      });

      const choice = chatResponse.choices[0];
      return {
        normalizedText: choice.message.content || null,
        message: {
          role: 'assistant',
          content: choice.message.content || '',
        },
        finish_reason: choice.finish_reason || 'stop',
        usage: chatResponse.usage ? {
          input_tokens: chatResponse.usage.prompt_tokens,
          output_tokens: chatResponse.usage.completion_tokens,
          total_tokens: chatResponse.usage.total_tokens,
          cost: this.calculateCost(
            chatResponse.usage.prompt_tokens || 0,
            chatResponse.usage.completion_tokens || 0,
            model
          )
        } : undefined
      };
    } catch (error) {
      logger.error('Error generating image description:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number, model: SupportedModel): string {
    const pricing = GPT5_PRICING[model];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return `$${(inputCost + outputCost).toFixed(6)}`;
  }
}

async function ensureDirectories(): Promise<void> {
  if (isDirectoryInitialized) return;
  
  try {
    await fs.promises.mkdir(OUTPUT_PATH, { recursive: true });
    await fs.promises.mkdir(TTS_OUTPUT_PATH, { recursive: true });
    isDirectoryInitialized = true;
  } catch (error) {
    logger.error('Failed to create output directories:', error);
    throw new Error('Failed to initialize output directories');
  }
}