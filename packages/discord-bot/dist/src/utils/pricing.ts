import { logger } from './logger.js';

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

const TEXT_MODEL_PRICING: Record<TextModelPricingKey, { input: number; output: number }> = {
    // Pricing per 1M tokens (USD) sourced from https://platform.openai.com/pricing (2025-03)
    'gpt-5': { input: 1.25, output: 10 },
    'gpt-5-mini': { input: 0.25, output: 2.0 },
    'gpt-5-nano': { input: 0.05, output: 0.4 },
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4.1': { input: 15, output: 60 },
    'gpt-4.1-mini': { input: 3, output: 12 },
    'gpt-4.1-nano': { input: 1, output: 4 }
};

const IMAGE_GENERATION_COST_TABLE: Record<Exclude<ImageGenerationQuality, 'auto'>, Record<'1024x1024' | '1024x1536' | '1536x1024', number>> = {
    // Pricing per image in USD for gpt-image-1 (2025-03)
    low: {
        '1024x1024': 0.04,
        '1024x1536': 0.06,
        '1536x1024': 0.06
    },
    medium: {
        '1024x1024': 0.08,
        '1024x1536': 0.12,
        '1536x1024': 0.12
    },
    high: {
        '1024x1024': 0.12,
        '1024x1536': 0.18,
        '1536x1024': 0.18
    }
};

export function estimateTextCost(model: TextModelPricingKey, inputTokens: number, outputTokens: number): TextCostBreakdown {
    const pricing = TEXT_MODEL_PRICING[model];
    if (!pricing) {
        logger.warn(`No pricing information found for model ${model}. Assuming zero cost.`);
        return {
            inputTokens,
            outputTokens,
            inputCost: 0,
            outputCost: 0,
            totalCost: 0
        };
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return {
        inputTokens,
        outputTokens,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost
    };
}

export function estimateImageGenerationCost(options: ImageGenerationCostOptions): ImageGenerationCostEstimate {
    const imageCount = Math.max(1, options.imageCount ?? 1);
    const effectiveQuality = options.quality === 'auto' ? 'low' : options.quality; // 
    const effectiveSize = options.size === 'auto' ? '1024x1024' : options.size; // TODO: retrieve actual size chosen by OpenAI

    const qualityPricing = IMAGE_GENERATION_COST_TABLE[effectiveQuality];
    const perImageCost = qualityPricing?.[effectiveSize] ?? 0;
    if (perImageCost === 0) {
        logger.warn(`Unable to determine pricing for quality ${effectiveQuality} and size ${effectiveSize}.`);
    }

    const totalCost = perImageCost * imageCount;

    return {
        effectiveQuality,
        effectiveSize,
        imageCount,
        perImageCost,
        totalCost
    };
}

export function formatUsd(amount: number, fractionDigits = 6): string {
    return `$${amount.toFixed(fractionDigits)}`;
}

export function describeTokenUsage(usage?: { input_tokens?: number | null; output_tokens?: number | null; total_tokens?: number | null }): string {
    if (!usage) {
        return 'Tokens: unknown';
    }

    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    const total = usage.total_tokens ?? (input + output);
    return `Tokens • In: ${input} • Out: ${output} • Total: ${total}`;
}

export { TEXT_MODEL_PRICING, IMAGE_GENERATION_COST_TABLE };
