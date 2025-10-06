import type { Message } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_MODEL } from './constants.js';
import type { ImageGenerationContext } from './followUpCache.js';
import type {
    ImageBackgroundType,
    ImageQualityType,
    ImageResponseModel,
    ImageSizeType,
    ImageStylePreset
} from './types.js';

const ASPECT_RATIO_LABELS: Record<ImageGenerationContext['aspectRatio'], string> = {
    auto: 'Auto',
    square: 'Square',
    portrait: 'Portrait',
    landscape: 'Landscape'
};

const QUALITY_VALUES: ImageQualityType[] = ['low', 'medium', 'high'];
const BACKGROUND_VALUES: ImageBackgroundType[] = ['auto', 'transparent', 'opaque'];
const STYLE_VALUES: ImageStylePreset[] = [
    'natural',
    'vivid',
    'photorealistic',
    'cinematic',
    'oil_painting',
    'watercolor',
    'digital_painting',
    'line_art',
    'sketch',
    'cartoon',
    'anime',
    'comic',
    'pixel_art',
    'cyberpunk',
    'fantasy_art',
    'surrealist',
    'minimalist',
    'vintage',
    'noir',
    '3d_render',
    'steampunk',
    'abstract',
    'pop_art',
    'dreamcore',
    'isometric',
    'unspecified'
];

const STYLE_SET = new Set<ImageStylePreset>(STYLE_VALUES);

const SIZE_VALUES: ImageSizeType[] = ['auto', '1024x1024', '1024x1536', '1536x1024'];
const ASPECT_VALUES: ImageGenerationContext['aspectRatio'][] = ['auto', 'square', 'portrait', 'landscape'];

function parseQuality(value: string | null | undefined): ImageQualityType {
    const normalised = value?.trim().toLowerCase() ?? '';
    return QUALITY_VALUES.includes(normalised as ImageQualityType) ? (normalised as ImageQualityType) : 'low';
}

function parseBackground(value: string | null | undefined): ImageBackgroundType {
    const normalised = value?.trim().toLowerCase() ?? '';
    return BACKGROUND_VALUES.includes(normalised as ImageBackgroundType) ? (normalised as ImageBackgroundType) : 'auto';
}

function parseStyle(value: string | null | undefined): ImageStylePreset {
    if (!value) {
        return 'unspecified';
    }

    const normalised = value.trim().toLowerCase().replace(/\s+/g, '_') as ImageStylePreset;
    return STYLE_SET.has(normalised) ? normalised : 'unspecified';
}

function parseAspectRatio(value: string | null | undefined): ImageGenerationContext['aspectRatio'] {
    const normalised = value?.trim().toLowerCase() ?? '';
    return ASPECT_VALUES.includes(normalised as ImageGenerationContext['aspectRatio'])
        ? (normalised as ImageGenerationContext['aspectRatio'])
        : 'auto';
}

function parseSize(value: string | null | undefined): ImageSizeType {
    const normalised = value?.trim().toLowerCase() ?? '';
    return SIZE_VALUES.includes(normalised as ImageSizeType) ? (normalised as ImageSizeType) : 'auto';
}

function parseModel(value: string | null | undefined): ImageResponseModel {
    const normalised = value?.trim() as ImageResponseModel | undefined;
    return normalised ?? DEFAULT_MODEL;
}

interface PromptExtractionResult {
    prompt: string | null;
    truncated: boolean;
}

function collectPromptSections(
    fieldMap: Map<string, string>,
    label: string
): PromptExtractionResult {
    const baseField = fieldMap.get(label);
    if (!baseField) {
        return { prompt: null, truncated: false };
    }

    const sections: string[] = [baseField];
    let sectionIndex = 1;
    while (true) {
        const continuation = fieldMap.get(`${label} (cont. ${sectionIndex})`);
        if (!continuation) {
            break;
        }
        sections.push(continuation);
        sectionIndex += 1;
    }

    const truncatedFlag = fieldMap.get(`${label} Truncated`)?.toLowerCase() === 'true';
    return { prompt: sections.join(''), truncated: truncatedFlag };
}

function buildContextFromEmbed(message: Message): ImageGenerationContext | null {
    const embed = message.embeds?.[0];
    if (!embed) {
        return null;
    }

    const fieldMap = new Map<string, string>();
    for (const field of embed.fields ?? []) {
        fieldMap.set(field.name, field.value ?? '');
    }

    const originalPromptResult = collectPromptSections(fieldMap, 'Original Prompt');
    if (!originalPromptResult.prompt) {
        logger.warn('Unable to recover original prompt from embed fields.');
        return null;
    }

    const refinedPromptResult = collectPromptSections(fieldMap, 'Refined Prompt');
    const activePromptField = collectPromptSections(fieldMap, 'Prompt for Variations');
    const prompt = activePromptField.prompt ?? refinedPromptResult.prompt ?? originalPromptResult.prompt;

    const aspectRatio = parseAspectRatio(fieldMap.get('Aspect Ratio'));
    const size = parseSize(fieldMap.get('Size'));

    const allowAdjustmentRaw = fieldMap.get('Allow Prompt Adjustment');
    const allowPromptAdjustment = allowAdjustmentRaw
        ? allowAdjustmentRaw.trim().toLowerCase() !== 'false'
        : true;

    const refinedPrompt = refinedPromptResult.prompt;
    const refinedPromptTruncated = refinedPromptResult.truncated;
    const originalPromptTruncated = originalPromptResult.truncated;

    if (originalPromptTruncated || refinedPromptTruncated) {
        logger.warn('Recovered prompt may be truncated due to embed limits.');
    }

    return {
        prompt,
        originalPrompt: originalPromptResult.prompt,
        refinedPrompt,
        model: parseModel(fieldMap.get('Model')),
        size,
        aspectRatio,
        aspectRatioLabel: ASPECT_RATIO_LABELS[aspectRatio],
        quality: parseQuality(fieldMap.get('Quality')),
        background: parseBackground(fieldMap.get('Background')),
        style: parseStyle(fieldMap.get('Style')),
        allowPromptAdjustment
    };
}

/**
 * Rebuilds the image generation context from the embed that announced the
 * image. We intentionally keep this synchronous so callers can reuse the logic
 * during interaction handling without awaiting network I/O.
 */
export async function recoverContextFromMessage(message: Message): Promise<ImageGenerationContext | null> {
    return buildContextFromEmbed(message);
}
