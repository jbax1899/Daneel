import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { logger } from './logger.js'
import { ActivityOptions } from 'discord.js';

// ====================
// Type Declarations
// ====================

export type SupportedModel = GPT5ModelType | ImageGenerationModelType; 
export type GPT5ModelType = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
export type ImageGenerationModelType = 'gpt-image-1' | 'dall-e-2' | 'dall-e-3';
export type ImageGenerationResolutionType = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
export type ImageGenerationQualityType = 'low' | 'medium' | 'high' | 'auto';
export type EmbeddingModelType = 'text-embedding-3-small'; // Dimensions: 1546

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
}

export type TTSOptions = {
  model: 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';
  voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer';
  speed?: 'slow' | 'normal' | 'fast';
  pitch?: 'low' | 'normal' | 'high';
  emphasis?: 'none' | 'moderate' | 'strong';
  style?: 'casual' | 'narrative' | 'cheerful' | 'sad' | 'angry' | string;
  styleDegree?: 'low' | 'normal' | 'high';
  styleNote?: string;
}

export interface OpenAIOptions {
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  webSearch?: {
    query?: string;
    allowedDomains?: string[]; // Up to 20 domains
    searchContextSize?: 'low' | 'medium' | 'high';
    userLocation?: {
      type?: 'approximate' | 'exact';
      country?: string; // ISO country code (e.g., 'US', 'GB')
      city?: string;
      region?: string;
      timezone?: string; // IANA timezone (e.g., 'America/Chicago')
    };
  };
  ttsOptions?: TTSOptions;
  functions?: Array<{
    name: string;
    description?: string;
    parameters: Record<string, any>;
  }>;
  function_call?: { name: string } | 'auto' | 'none' | 'required' | null;
  tool_choice?: {
    type: 'function' | 'web_search';
    function: { name: string };
  } | 'none' | 'auto' | null;
}

export interface OpenAIResponse {
  normalizedText?: string | null;
  message?: {
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: string;
    function_call?: { name: string; arguments?: string } | null;
    citations?: Array<{
      url: string;
      title: string;
      text: string;
    }>;
  };
  finish_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost?: string;
  };
  newPresence?: ActivityOptions;
}

// Extended interface for OpenAI Responses output items
interface ResponseOutputItemExtended {
  type?: string; // "reasoning", "function_call", "message", etc.
  role?: 'user' | 'assistant' | 'system' | 'developer';
  name?: string; // present on type "function_call"
  arguments?: string; // present on type "function_call"
  tool_calls?: Array<{ function: { name: string; arguments?: string } }>;
  function_call?: { name: string; arguments?: string };
  tool?: { name: string; arguments?: string };
  content?: Array<{ 
    type: string; 
    text?: string;
    annotations?: Array<{
      type: string;
      url?: string;
      title?: string;
      start_index: number;
      end_index: number;
    }>;
  }>;
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
export const IMAGE_DESCRIPTION_MODEL: SupportedModel = 'gpt-5-mini';

export const DEFAULT_IMAGE_GENERATION_MODEL: SupportedModel = 'gpt-image-1';
export const DEFAULT_IMAGE_GENERATION_RESOLUTION: ImageGenerationResolutionType = '1024x1024';
export const DEFAULT_IMAGE_GENERATION_QUALITY: ImageGenerationQualityType = 'low';

export const DEFAULT_EMBEDDING_MODEL: EmbeddingModelType = 'text-embedding-3-small';

let isDirectoryInitialized = false; // Tracks if output directories have been initialized

export const TTS_DEFAULT_OPTIONS: TTSOptions = {
  model: 'gpt-4o-mini-tts',
  voice: 'echo',
  speed: 'normal',
  pitch: 'normal',
  emphasis: 'moderate',
  style: 'conversational',
  styleDegree: 'normal'
}

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
    return this.generateGPT5Response(model as GPT5ModelType, messages, options);
  }

  private async generateGPT5Response(
    model: GPT5ModelType,
    messagesInput: OpenAIMessage[],
    options: OpenAIOptions
  ): Promise<OpenAIResponse> {
    const { reasoningEffort = 'low', verbosity = 'low' } = options;

    try {
      // Map messages for the OpenAI Responses API
      const messages = messagesInput.map(msg => ({
        role: msg.role,
        content: [{
          type: msg.role === 'assistant' ? 'output_text' : 'input_text' as const,
          text: msg.content
        }]
      }));

      const tools: any[] = []; // Initialize tools array
      const doingWebSearch = typeof options.tool_choice === 'object' && 
                              options.tool_choice !== null && 
                              options.tool_choice.type === 'web_search';
      
      // Add web search tool if enabled
      if (doingWebSearch) {
        // Create web search tool
        const webSearchTool: any = {
          type: 'web_search',
        };

        // Add optional web search parameters
        if (options.webSearch?.allowedDomains?.length) {
          webSearchTool.filters = {
            allowed_domains: options.webSearch.allowedDomains
          };
        }

        if (options.webSearch?.searchContextSize) {
          webSearchTool.search_context_size = options.webSearch.searchContextSize;
        }

        if (options.webSearch?.userLocation) {
          webSearchTool.user_location = {
            ...options.webSearch.userLocation
          };
        }

        tools.push(webSearchTool);
      }

      // Add function tools if any (separate from web search tool)
      if (options.functions?.length) {
        tools.push(...options.functions.map(fn => ({
          type: 'function' as const,
          name: fn.name,
          description: fn.description || '',
          parameters: fn.parameters || {},
          strict: false
        })));
      }

      // Create request payload to pass to OpenAI
      const requestPayload: any = {
        model,
        input: [
          ...messages,
          ...(doingWebSearch ? [{
            role: 'system' as const,
            content: `The planner instructed you to perform a web search for: ${options.webSearch?.query}`
          }] : []),
          //...(options.ttsOptions ? [{ role: 'system' as const, content: `This message will be read as TTS. If appropriate, add a little emphasis with italics (wrap with *), bold (wrap with **), and/or UPPERCASE (shouting).` }] : []) 
          //TODO: Always apppended, even if not tts
        ],
        ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
        ...(verbosity && { text: { verbosity } }),
        ...(tools.length > 0 && { tools })
      };

      logger.debug(`Generating AI response with payload: ${JSON.stringify(requestPayload)}`); // TODO: Remove

      // Generate response
      const response = await this.openai.responses.create(requestPayload);

      // Get output items from response
      const outputItems = response.output as ResponseOutputItemExtended[];

      // Find the assistant's message and web search results
      let outputText = '';
      let finishReason = 'stop';
      const citations: Array<{url: string; title: string; text: string}> = [];

      for (const item of outputItems ?? []) {
        // Handle message with citations
        if (item.type === 'message' && item.role === 'assistant' && item.content) {
          const textContent = item.content.find(c => c.type === 'output_text');
          if (textContent?.text) {
            outputText = textContent.text;
            
            // Extract citations if any
            if (textContent.annotations?.length) {
              for (const annotation of textContent.annotations) {
                if (annotation.type === 'url_citation' && annotation.url) {
                  citations.push({
                    url: annotation.url,
                    title: annotation.title || 'Source',
                    text: outputText.slice(annotation.start_index, annotation.end_index)
                  });
                }
              }
            }
          }
          finishReason = item.finish_reason || finishReason;
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

      // Handle function calls if any
      let parsedFunctionCall: { name: string; arguments: string } | null = null;
      for (const item of outputItems ?? []) {
        if ((item.type === 'function_call' || item.type === 'tool_calls') && item.name) {
          parsedFunctionCall = { 
            name: item.name, 
            arguments: item.arguments || '{}' 
          };
          break;
        }
      }

      return {
        normalizedText: outputText,
        message: {
          role: 'assistant',
          content: outputText,
          ...(parsedFunctionCall && { function_call: parsedFunctionCall }),
          ...(citations.length > 0 && { citations })
        },
        finish_reason: finishReason,
        usage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
          total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
          cost: this.calculateCost(
            response.usage?.input_tokens ?? 0,
            response.usage?.output_tokens ?? 0,
            model
          )
        }
      };

    } catch (error) {
      logger.error('Error in generateGPT5Response:', error);
      throw error;
    }
  }

  public async generateSpeech(
    input: string, 
    instructions: TTSOptions,
    filename: string, 
    format: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm') {
    //https://platform.openai.com/docs/guides/text-to-speech
    if (!filename || !/^[\w\-]+$/.test(filename)) {
      throw new Error('Invalid filename. Only alphanumeric characters, hyphens, and underscores are allowed.');
    }
    
    const outputPath = path.join(TTS_OUTPUT_PATH, `${filename}.${format}`);

    logger.debug(`Generating speech file: ${outputPath}...`);
    logger.debug(`Using TTS options: ${JSON.stringify(instructions)}`);

    try {
      const mp3 = await this.openai.audio.speech.create({
        model: instructions.model,
        voice: instructions.voice,
        input: input,
        instructions: `Speed: ${instructions.speed}, Pitch: ${instructions.pitch}, Emphasis: ${instructions.emphasis}, Style: ${instructions.style}, Style weight: ${instructions.styleDegree}, Other style notes: ${instructions.styleNote}`,
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
    context?: string
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
        model: IMAGE_DESCRIPTION_MODEL,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `What's in this image?${context ? ` (Additional context: ${context})` : ''}`
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
      const imageDescriptionResponse: OpenAIResponse = {
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
            IMAGE_DESCRIPTION_MODEL as GPT5ModelType
          )
        } : undefined
      };
      logger.debug(`Image description generated: ${imageDescriptionResponse.message?.content}${imageDescriptionResponse.usage ? ` (Cost: ${imageDescriptionResponse.usage.cost})` : ''}`);
      return imageDescriptionResponse;
    } catch (error) {
      logger.error('Error generating image description:', error);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number, model: GPT5ModelType): string {
    const pricing = GPT5_PRICING[model];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return `$${(inputCost + outputCost).toFixed(6)}`;
  }

  /*
  public async generateImage(prompt: string, model?: ImageGenerationModelType): Promise<Buffer> {
    //TODO
  }
  */

  /**
   * Embeds text using the default embedding model.
   * @param text The text to embed.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  public async embedText(text: string, dimensions: number = 1024): Promise<number[]> {
    const embedding = await this.openai.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: text,
      dimensions
    });
    return embedding.data[0].embedding;
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