export type GPT5ModelType = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';
export type OmniModelType = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano';
export type TextModelPricingKey = GPT5ModelType | OmniModelType;
export type ImageGenerationQuality = 'low' | 'medium' | 'high' | 'auto';
export type ImageGenerationSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
export interface TextCostBreakdown {
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
}
export interface ImageGenerationCostOptions {
    quality: ImageGenerationQuality;
    size: ImageGenerationSize;
    imageCount?: number;
}
export interface ImageGenerationCostEstimate {
    effectiveQuality: Exclude<ImageGenerationQuality, 'auto'>;
    effectiveSize: Exclude<ImageGenerationSize, 'auto'>;
    imageCount: number;
    perImageCost: number;
    totalCost: number;
}
declare const TEXT_MODEL_PRICING: Record<TextModelPricingKey, {
    input: number;
    output: number;
}>;
declare const IMAGE_GENERATION_COST_TABLE: Record<Exclude<ImageGenerationQuality, 'auto'>, Record<'1024x1024' | '1024x1536' | '1536x1024', number>>;
export declare function estimateTextCost(model: TextModelPricingKey, inputTokens: number, outputTokens: number): TextCostBreakdown;
export declare function estimateImageGenerationCost(options: ImageGenerationCostOptions): ImageGenerationCostEstimate;
export declare function formatUsd(amount: number, fractionDigits?: number): string;
export declare function describeTokenUsage(usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_tokens?: number | null;
}): string;
export { TEXT_MODEL_PRICING, IMAGE_GENERATION_COST_TABLE };
