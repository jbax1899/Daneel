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
    function_call?: {
        name: string;
    } | 'auto' | 'none' | 'required' | null;
    tool_choice?: {
        type: 'function';
        function: {
            name: string;
        };
    } | 'none' | 'auto' | null;
}
export interface OpenAIResponse {
    normalizedText: string | null;
    message: {
        role: 'user' | 'assistant' | 'system' | 'developer';
        content: string;
        function_call?: {
            name: string;
            arguments?: string;
        } | null;
    };
    finish_reason: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        cost?: string;
    };
}
export declare class OpenAIService {
    private openai;
    defaultModel: SupportedModel;
    constructor(apiKey: string);
    generateResponse(model: SupportedModel | undefined, messages: OpenAIMessage[], options?: OpenAIOptions): Promise<OpenAIResponse>;
    private generateGPT5Response;
    generateSpeech(model: TTSModel, voice: TTSVoice, input: string, instructions: string, filename: string, format: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'): Promise<string>;
    private calculateCost;
}
