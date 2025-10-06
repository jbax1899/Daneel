import type { Message } from 'discord.js';
import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';
import { DEFAULT_MODEL, IMAGE_CONTEXT_ATTACHMENT_NAME, PROMPT_SEGMENT_FIELD_PREFIX } from './constants.js';
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

const BOOLEAN_TRUE = new Set(['true', 'yes', '1']);

function parseBoolean(value: string | null | undefined): boolean {
    if (!value) {
        return false;
    }

    return BOOLEAN_TRUE.has(value.trim().toLowerCase());
}

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

function extractPromptFromEmbed(message: Message): string | null {
    const embed = message.embeds?.[0];
    if (!embed) {
        return null;
    }

    const segments = (embed.fields ?? []).filter(field =>
        field.name.toLowerCase().startsWith(PROMPT_SEGMENT_FIELD_PREFIX.toLowerCase())
    );

    if (segments.length === 0) {
        return null;
    }

    const ordered = segments
        .map(field => {
            const match = field.name.match(/(\d+)/);
            const index = match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
            return { index, value: field.value ?? '' };
        })
        .sort((a, b) => a.index - b.index);

    return ordered.map(segment => segment.value).join('');
}

function buildContextFromEmbed(
    message: Message,
    options: { allowPreviewFallback?: boolean } = {}
): ImageGenerationContext | null {
    const embed = message.embeds?.[0];
    if (!embed) {
        return null;
    }

    const fieldMap = new Map<string, string>();
    for (const field of embed.fields ?? []) {
        fieldMap.set(field.name, field.value ?? '');
    }

    const promptFromSegments = extractPromptFromEmbed(message);
    const prompt = promptFromSegments ?? (options.allowPreviewFallback ? fieldMap.get('Prompt Preview') ?? null : null);
    if (!prompt) {
        return null;
    }

    const aspectRatio = parseAspectRatio(fieldMap.get('Aspect Ratio'));
    const size = parseSize(fieldMap.get('Size'));

    return {
        prompt,
        model: parseModel(fieldMap.get('Model')),
        size,
        aspectRatio,
        aspectRatioLabel: ASPECT_RATIO_LABELS[aspectRatio],
        quality: parseQuality(fieldMap.get('Quality')),
        qualityRestricted: parseBoolean(fieldMap.get('Quality Restricted')),
        background: parseBackground(fieldMap.get('Background')),
        style: parseStyle(fieldMap.get('Style')),
        allowPromptAdjustment: parseBoolean(fieldMap.get('Allow Prompt Adjustment'))
    };
}

async function buildContextFromAttachment(message: Message): Promise<ImageGenerationContext | null> {
    const attachment = message.attachments.find(file => file.name === IMAGE_CONTEXT_ATTACHMENT_NAME);
    if (!attachment) {
        return null;
    }

    try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
            logger.warn(`Failed to fetch image context attachment: HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (!data || typeof data !== 'object') {
            return null;
        }

        const rawContext = (data as { context?: ImageGenerationContext }).context;
        if (!rawContext) {
            return null;
        }

        const aspectRatio = parseAspectRatio(rawContext.aspectRatio);

        return {
            prompt: rawContext.prompt,
            model: parseModel(rawContext.model),
            size: parseSize(rawContext.size),
            aspectRatio,
            aspectRatioLabel: rawContext.aspectRatioLabel ?? ASPECT_RATIO_LABELS[aspectRatio],
            quality: parseQuality(rawContext.quality),
            qualityRestricted: Boolean(rawContext.qualityRestricted),
            background: parseBackground(rawContext.background),
            style: parseStyle(rawContext.style),
            allowPromptAdjustment: Boolean(rawContext.allowPromptAdjustment)
        };
    } catch (error) {
        logger.error('Failed to download cached image context attachment:', error);
        return null;
    }
}

/**
 * Attempts to reconstruct an image generation context from the Discord message
 * that announced the image. Embeds are preferred because they keep metadata
 * indexable via Discord's search, while the attachment serves as a precise
 * fallback if the embed was modified or trimmed.
 */
export async function recoverContextFromMessage(message: Message): Promise<ImageGenerationContext | null> {
    const fromEmbed = buildContextFromEmbed(message);
    if (fromEmbed) {
        return fromEmbed;
    }

    const fromAttachment = await buildContextFromAttachment(message);
    if (fromAttachment) {
        return fromAttachment;
    }

    return buildContextFromEmbed(message, { allowPreviewFallback: true });
}
