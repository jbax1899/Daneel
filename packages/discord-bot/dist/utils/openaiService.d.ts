import { ActivityOptions } from 'discord.js';
import { type GPT5ModelType } from './pricing.js';
export type { GPT5ModelType } from './pricing.js';
export type SupportedModel = GPT5ModelType;
export type EmbeddingModelType = 'text-embedding-3-small';
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
};
export interface OpenAIOptions {
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
    webSearch?: {
        query?: string;
        allowedDomains?: string[];
        searchContextSize?: 'low' | 'medium' | 'high';
        userLocation?: {
            type?: 'approximate' | 'exact';
            country?: string;
            city?: string;
            region?: string;
            timezone?: string;
        };
    };
    ttsOptions?: TTSOptions;
    functions?: Array<{
        name: string;
        description?: string;
        parameters: Record<string, any>;
    }>;
    function_call?: {
        name: string;
    } | 'auto' | 'none' | 'required' | null;
    tool_choice?: {
        type: 'function' | 'web_search';
        function: {
            name: string;
        };
    } | 'none' | 'auto' | null;
}
export interface OpenAIResponse {
    normalizedText?: string | null;
    message?: {
        role: 'user' | 'assistant' | 'system' | 'developer';
        content: string;
        function_call?: {
            name: string;
            arguments?: string;
        } | null;
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
export declare const IMAGE_DESCRIPTION_MODEL: SupportedModel;
export declare const DEFAULT_EMBEDDING_MODEL: EmbeddingModelType;
export declare const TTS_DEFAULT_OPTIONS: TTSOptions;
export declare class OpenAIService {
    private openai;
    defaultModel: SupportedModel;
    constructor(apiKey: string);
    generateResponse(model: SupportedModel | undefined, messages: OpenAIMessage[], options?: OpenAIOptions): Promise<OpenAIResponse>;
    private generateGPT5Response;
    generateSpeech(input: string, instructions: TTSOptions, filename: string, format: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'): Promise<string>;
    generateImageDescription(imageUrl: string, // URL from Discord attachment
    context?: string): Promise<OpenAIResponse>;
    /**
     * Embeds text using the default embedding model.
     * @param text The text to embed.
     * @returns A Promise that resolves to an array of numbers representing the embedding.
     */
    embedText(text: string, dimensions?: number): Promise<number[]>;
    /**
     * Reduces the provided array of OpenAI messages to minimal summaries.
     * If the input string is sufficiently short, it is returned as-is.
     * Otherwise, it is summarized.
     * @param context The context to reduce.
     * @returns The reduced context.
     */
    reduceContext(context: OpenAIMessage[]): Promise<OpenAIMessage[]>;
}
