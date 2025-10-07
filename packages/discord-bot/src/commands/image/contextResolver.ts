import type { Message } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_MODEL } from './constants.js';
import { clampPromptForContext } from './sessionHelpers.js';
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

// We only need a small look-back/look-ahead window when a user replies to a
// follow-up message instead of the original embed. Keeping the search tight
// avoids unnecessary API calls while still finding the intended image quickly.
const NEARBY_SEARCH_LIMIT = 15;

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

    const normalised = value.trim().toLowerCase();
    if (normalised === 'auto') {
        return 'unspecified';
    }

    const formatted = normalised.replace(/\s+/g, '_') as ImageStylePreset;
    return STYLE_SET.has(formatted) ? formatted : 'unspecified';
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

function parsePromptAdjustment(value: string | null | undefined): boolean {
    const normalised = value?.trim().toLowerCase();
    if (!normalised) {
        return true;
    }

    if (normalised === 'disabled' || normalised === 'false' || normalised === 'no') {
        return false;
    }

    return true;
}

interface PromptExtractionResult {
    prompt: string | null;
    truncated: boolean;
    fieldName: string | null;
}

interface RecoveredContextDetails {
    context: ImageGenerationContext;
    /**
     * The response identifier associated with the embed. This is required when
     * we want to request true variations from the API rather than starting a
     * fresh generation.
     */
    responseId: string | null;
    /**
     * The input identifier, if available. This allows callers to chain
     * multiple variations by falling back to the previous response when an
     * embed predates the field update that surfaces output IDs.
     */
    inputId: string | null;
}

// Prompt labels are now dynamic (e.g., "Refined Prompt (gpt-4.1-mini)") so we
// need to locate entries by prefix rather than assuming a fixed field name.
function findPromptBaseField(fieldMap: Map<string, string>, label: string): string | null {
    if (fieldMap.has(label)) {
        return label;
    }

    for (const key of fieldMap.keys()) {
        if (key === label) {
            return key;
        }
        if (key.startsWith(`${label} (`)) {
            return key;
        }
    }

    return null;
}

function collectPromptSections(
    fieldMap: Map<string, string>,
    label: string
): PromptExtractionResult {
    const baseFieldName = findPromptBaseField(fieldMap, label);
    if (!baseFieldName) {
        return { prompt: null, truncated: false, fieldName: null };
    }

    const baseField = fieldMap.get(baseFieldName);
    if (typeof baseField !== 'string') {
        return { prompt: null, truncated: false, fieldName: baseFieldName };
    }

    const sections: string[] = [baseField];
    let sectionIndex = 1;
    while (true) {
        const continuation = fieldMap.get(`${label} (cont. ${sectionIndex})`) ?? fieldMap.get(`${baseFieldName} (cont. ${sectionIndex})`);
        if (!continuation) {
            break;
        }
        sections.push(continuation);
        sectionIndex += 1;
    }

    let combined = sections.join('');
    let truncatedFlag = false;

    if (combined.endsWith('\n*(truncated)*')) {
        combined = combined.slice(0, combined.length - '\n*(truncated)*'.length);
        truncatedFlag = true;
    }

    const legacyTruncation = fieldMap.get(`${label} Truncated`)?.toLowerCase() === 'true';
    truncatedFlag = truncatedFlag || legacyTruncation;

    return { prompt: combined, truncated: truncatedFlag, fieldName: baseFieldName };
}

function parseIdentifier(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }

    const normalised = raw.replace(/`/g, '').trim();
    if (!normalised || normalised.toLowerCase() === 'n/a') {
        return null;
    }

    return normalised;
}

// Extracts the model hint that we embed within prompt labels. This keeps
// historical embeds backwards compatible while giving reboot recovery a single
// place to pull the active model when caching is unavailable.
function extractModelFromPromptLabel(label: string | null | undefined): string | null {
    if (!label) {
        return null;
    }

    const match = /^\s*(?:Original|Refined) Prompt\s*\(([^)]+)\)\s*$/i.exec(label);
    return match ? match[1].trim() : null;
}

function buildContextFromEmbed(message: Message): RecoveredContextDetails | null {
    const embed = message.embeds?.[0];
    if (!embed) {
        return null;
    }

    const fieldMap = new Map<string, string>();
    for (const field of embed.fields ?? []) {
        fieldMap.set(field.name, field.value ?? '');
    }

    const originalPromptResult = collectPromptSections(fieldMap, 'Original Prompt');
    const refinedPromptResult = collectPromptSections(fieldMap, 'Refined Prompt');
    const prompt = refinedPromptResult.prompt ?? originalPromptResult.prompt;

    if (!prompt) {
        logger.warn('Unable to recover any prompt from embed fields.');
        return null;
    }

    if (!originalPromptResult.prompt) {
        logger.warn('Original prompt missing from embed; using recovered prompt as fallback.');
    }

    const aspectRatio = parseAspectRatio(fieldMap.get('Aspect Ratio'));
    const size = parseSize(fieldMap.get('Size'));

    const refinedPrompt = refinedPromptResult.prompt && refinedPromptResult.prompt !== prompt
        ? refinedPromptResult.prompt
        : null;
    const refinedPromptTruncated = refinedPrompt ? refinedPromptResult.truncated : false;
    const originalPromptTruncated = originalPromptResult.truncated;

    if (originalPromptTruncated || refinedPromptTruncated) {
        logger.warn('Recovered prompt may be truncated due to embed limits.');
    }

    const normalizedPrompt = clampPromptForContext(prompt);
    const normalizedOriginal = clampPromptForContext(originalPromptResult.prompt ?? prompt);
    const normalizedRefinedCandidate = refinedPrompt ? clampPromptForContext(refinedPrompt) : null;
    const normalizedRefined = normalizedRefinedCandidate && normalizedRefinedCandidate !== normalizedPrompt
        ? normalizedRefinedCandidate
        : null;

    const modelFromLabel = extractModelFromPromptLabel(refinedPromptResult.fieldName)
        ?? extractModelFromPromptLabel(originalPromptResult.fieldName)
        ?? fieldMap.get('Model');

    return {
        context: {
            prompt: normalizedPrompt,
            originalPrompt: normalizedOriginal,
            refinedPrompt: normalizedRefined,
            model: parseModel(modelFromLabel),
            size,
            aspectRatio,
            aspectRatioLabel: ASPECT_RATIO_LABELS[aspectRatio],
            quality: parseQuality(fieldMap.get('Quality')),
            background: parseBackground(fieldMap.get('Background')),
            style: parseStyle(fieldMap.get('Style')),
            allowPromptAdjustment: parsePromptAdjustment(fieldMap.get('Prompt Adjustment'))
        },
        responseId: parseIdentifier(fieldMap.get('Output ID')),
        inputId: parseIdentifier(fieldMap.get('Input ID'))
    };
}

/**
 * Rebuilds the image generation context from the embed that announced the
 * image. We intentionally keep this synchronous so callers can reuse the logic
 * during interaction handling without awaiting network I/O.
 */
export interface RecoveredImageContext extends RecoveredContextDetails {}

export async function recoverContextFromMessage(message: Message): Promise<ImageGenerationContext | null> {
    const recovered = await recoverContextDetailsFromMessage(message);
    return recovered ? recovered.context : null;
}

export async function recoverContextDetailsFromMessage(message: Message): Promise<RecoveredImageContext | null> {
    const direct = buildContextFromEmbed(message);
    if (direct) {
        return direct;
    }

    const channel = message.channel;
    const clientUserId = message.client.user?.id;

    if (!channel || !clientUserId) {
        return null;
    }

    try {
        // Users frequently reply to the textual commentary that follows an embed.
        // Walk the nearby history so we can locate the closest bot-authored image
        // message and rebuild the context from there.
        const surrounding = await Promise.all([
            channel.messages.fetch({ before: message.id, limit: NEARBY_SEARCH_LIMIT }),
            channel.messages.fetch({ after: message.id, limit: Math.min(NEARBY_SEARCH_LIMIT, 5) })
        ]);

        const candidates = [
            ...surrounding[0].values(),
            ...surrounding[1].values()
        ].filter(candidate => candidate.author?.id === clientUserId);

        candidates.sort((a, b) => {
            const distanceA = Math.abs(a.createdTimestamp - message.createdTimestamp);
            const distanceB = Math.abs(b.createdTimestamp - message.createdTimestamp);
            if (distanceA === distanceB) {
                return b.createdTimestamp - a.createdTimestamp;
            }
            return distanceA - distanceB;
        });

        for (const candidate of candidates) {
            const recovered = buildContextFromEmbed(candidate);
            if (recovered) {
                logger.debug(`Recovered image context from nearby bot message ${candidate.id}.`);
                return recovered;
            }
        }
    } catch (error) {
        logger.debug('Failed to recover context from nearby messages:', error);
    }

    return null;
}
