import { ActivityOptions } from 'discord.js';
export type SupportedModel = GPT5ModelType;
export type GPT5ModelType = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
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
    private calculateCost;
}
