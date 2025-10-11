import { logger } from './logger.js';
const TEXT_MODEL_PRICING = {
    // Pricing per 1M tokens (USD) sourced from https://platform.openai.com/pricing (2025-04)
    'gpt-5': { input: 1.25, output: 10.00 },
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4.1': { input: 2.00, output: 8.00 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-4.1-nano': { input: 0.10, output: 0.40 }
};
const IMAGE_GENERATION_COST_TABLE = {
    // Pricing per image in USD sourced from https://platform.openai.com/pricing (2025-04)
    'gpt-image-1': {
        low: {
            '1024x1024': 0.011,
            '1024x1536': 0.016,
            '1536x1024': 0.016
        },
        medium: {
            '1024x1024': 0.042,
            '1024x1536': 0.063,
            '1536x1024': 0.063
        },
        high: {
            '1024x1024': 0.167,
            '1024x1536': 0.25,
            '1536x1024': 0.25
        }
    },
    'gpt-image-1-mini': {
        low: {
            '1024x1024': 0.005,
            '1024x1536': 0.006,
            '1536x1024': 0.006
        },
        medium: {
            '1024x1024': 0.011,
            '1024x1536': 0.015,
            '1536x1024': 0.015
        },
        high: {
            '1024x1024': 0.036,
            '1024x1536': 0.052,
            '1536x1024': 0.052
        }
    }
};
function resolveEffectiveQuality(quality) {
    // The OpenAI API defaults to "low" when quality is set to "auto", so we
    // mirror that behaviour for cost estimations to keep the numbers aligned.
    return quality === 'auto' ? 'low' : quality;
}
function resolveEffectiveSize(size) {
    // The service currently resolves "auto" to a 1024x1024 canvas. If the API
    // ever exposes the chosen size we can update this logic to read it.
    return size === 'auto' ? '1024x1024' : size;
}
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
    // Even when callers forget to request a count we assume at least one image
    // so that the consumer receives a realistic non-zero cost estimate.
    const imageCount = Math.max(1, options.imageCount ?? 1);
    const effectiveQuality = resolveEffectiveQuality(options.quality);
    const effectiveSize = resolveEffectiveSize(options.size);
    const modelPricing = IMAGE_GENERATION_COST_TABLE[options.model];
    if (!modelPricing) {
        logger.warn(`Unable to locate pricing table for image model ${options.model}. Assuming zero cost.`);
        return {
            effectiveQuality,
            effectiveSize,
            imageCount,
            perImageCost: 0,
            totalCost: 0
        };
    }
    const qualityPricing = modelPricing[effectiveQuality];
    if (!qualityPricing) {
        logger.warn(`No pricing tier defined for quality ${effectiveQuality} on model ${options.model}. Assuming zero cost.`);
        return {
            effectiveQuality,
            effectiveSize,
            imageCount,
            perImageCost: 0,
            totalCost: 0
        };
    }
    const perImageCost = qualityPricing[effectiveSize];
    if (typeof perImageCost !== 'number') {
        logger.warn(`Unable to determine pricing for model ${options.model}, quality ${effectiveQuality}, and size ${effectiveSize}.`);
        return {
            effectiveQuality,
            effectiveSize,
            imageCount,
            perImageCost: 0,
            totalCost: 0
        };
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
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        logger.warn(`formatUsd received an invalid amount: ${amount}. Defaulting to $0.00.`);
        return '$0.00';
    }
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