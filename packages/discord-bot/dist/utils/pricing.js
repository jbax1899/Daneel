import { logger } from './logger.js';
const TEXT_MODEL_PRICING = {
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
const IMAGE_GENERATION_COST_TABLE = {
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
export function estimateTextCost(model, inputTokens, outputTokens) {
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
export function estimateImageGenerationCost(options) {
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
export function formatUsd(amount, fractionDigits = 6) {
    return `$${amount.toFixed(fractionDigits)}`;
}
export function describeTokenUsage(usage) {
    if (!usage) {
        return 'Tokens: unknown';
    }
    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    const total = usage.total_tokens ?? (input + output);
    return `Tokens • In: ${input} • Out: ${output} • Total: ${total}`;
}
export { TEXT_MODEL_PRICING, IMAGE_GENERATION_COST_TABLE };
//# sourceMappingURL=pricing.js.map