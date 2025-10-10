import { logger } from '../../utils/logger.js';
// Defaults stay in sync with environment overrides via the shared constants
// module, so every recovery path mirrors the slash-command behaviour.
import { DEFAULT_IMAGE_MODEL, DEFAULT_TEXT_MODEL } from './constants.js';
import { clampPromptForContext } from './sessionHelpers.js';
const ASPECT_RATIO_LABELS = {
    auto: 'Auto',
    square: 'Square',
    portrait: 'Portrait',
    landscape: 'Landscape'
};
const QUALITY_VALUES = ['low', 'medium', 'high'];
const BACKGROUND_VALUES = ['auto', 'transparent', 'opaque'];
const STYLE_VALUES = [
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
const STYLE_SET = new Set(STYLE_VALUES);
const SIZE_VALUES = ['auto', '1024x1024', '1024x1536', '1536x1024'];
const ASPECT_VALUES = ['auto', 'square', 'portrait', 'landscape'];
// We only need a small look-back/look-ahead window when a user replies to a
// follow-up message instead of the original embed. Keeping the search tight
// avoids unnecessary API calls while still finding the intended image quickly.
const NEARBY_SEARCH_LIMIT = 15;
function parseQuality(value) {
    const normalised = value?.trim().toLowerCase() ?? '';
    return QUALITY_VALUES.includes(normalised) ? normalised : 'low';
}
function parseBackground(value) {
    const normalised = value?.trim().toLowerCase() ?? '';
    return BACKGROUND_VALUES.includes(normalised) ? normalised : 'auto';
}
function parseStyle(value) {
    if (!value) {
        return 'unspecified';
    }
    const normalised = value.trim().toLowerCase();
    if (normalised === 'auto') {
        return 'unspecified';
    }
    const formatted = normalised.replace(/\s+/g, '_');
    return STYLE_SET.has(formatted) ? formatted : 'unspecified';
}
function parseAspectRatio(value) {
    const normalised = value?.trim().toLowerCase() ?? '';
    return ASPECT_VALUES.includes(normalised)
        ? normalised
        : 'auto';
}
function parseSize(value) {
    const normalised = value?.trim().toLowerCase() ?? '';
    return SIZE_VALUES.includes(normalised) ? normalised : 'auto';
}
function parseTextModel(value) {
    const normalised = value?.trim();
    return normalised ?? DEFAULT_TEXT_MODEL;
}
function parseImageModel(value) {
    const normalised = value?.trim();
    return normalised ?? DEFAULT_IMAGE_MODEL;
}
function parsePromptAdjustment(value) {
    const normalised = value?.trim().toLowerCase();
    if (!normalised) {
        return true;
    }
    if (normalised === 'disabled' || normalised === 'false' || normalised === 'no') {
        return false;
    }
    return true;
}
// Prompt labels are now dynamic (e.g., "Refined Prompt (gpt-4.1-mini)") so we
// need to locate entries by prefix rather than assuming a fixed field name.
function findPromptBaseField(fieldMap, label) {
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
function collectPromptSections(fieldMap, label) {
    const baseFieldName = findPromptBaseField(fieldMap, label);
    if (!baseFieldName) {
        return { prompt: null, truncated: false, fieldName: null };
    }
    const baseField = fieldMap.get(baseFieldName);
    if (typeof baseField !== 'string') {
        return { prompt: null, truncated: false, fieldName: baseFieldName };
    }
    const sections = [baseField];
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
function collectPromptSectionsWithFallback(fieldMap, labels) {
    for (const label of labels) {
        const result = collectPromptSections(fieldMap, label);
        if (result.prompt) {
            return result;
        }
    }
    return { prompt: null, truncated: false, fieldName: null };
}
function parseIdentifier(raw) {
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
function extractModelFromPromptLabel(label) {
    if (!label) {
        return null;
    }
    const match = /^\s*(?:Original|Refined|Current) Prompt\s*\(([^)]+)\)\s*$/i.exec(label);
    return match ? match[1].trim() : null;
}
function extractModelFromQualityField(value) {
    if (!value) {
        return null;
    }
    const match = /\(([^)]+)\)\s*$/.exec(value);
    return match ? match[1].trim() : null;
}
function buildContextFromEmbed(message) {
    const embed = message.embeds?.[0];
    if (!embed) {
        return null;
    }
    const fieldMap = new Map();
    for (const field of embed.fields ?? []) {
        fieldMap.set(field.name, field.value ?? '');
    }
    const currentPromptResult = collectPromptSectionsWithFallback(fieldMap, ['Current prompt', 'Refined Prompt']);
    const originalPromptResult = collectPromptSectionsWithFallback(fieldMap, ['Original prompt', 'Original Prompt']);
    const legacyRefinedResult = collectPromptSections(fieldMap, 'Refined Prompt');
    const prompt = currentPromptResult.prompt ?? legacyRefinedResult.prompt ?? originalPromptResult.prompt;
    if (!prompt) {
        logger.warn('Unable to recover any prompt from embed fields.');
        return null;
    }
    if (!originalPromptResult.prompt) {
        logger.warn('Original prompt missing from embed; using recovered prompt as fallback.');
    }
    const aspectRatio = parseAspectRatio(fieldMap.get('Aspect ratio') ?? fieldMap.get('Aspect Ratio'));
    const size = parseSize(fieldMap.get('Resolution') ?? fieldMap.get('Size'));
    let refinedPrompt = null;
    let refinedPromptField = null;
    let refinedPromptTruncated = false;
    if (legacyRefinedResult.prompt) {
        refinedPrompt = legacyRefinedResult.prompt;
        refinedPromptField = legacyRefinedResult.fieldName;
        refinedPromptTruncated = legacyRefinedResult.truncated;
    }
    else if (currentPromptResult.prompt
        && originalPromptResult.prompt
        && currentPromptResult.prompt !== originalPromptResult.prompt) {
        refinedPrompt = currentPromptResult.prompt;
        refinedPromptField = currentPromptResult.fieldName;
        refinedPromptTruncated = currentPromptResult.truncated;
    }
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
    const textModelHint = extractModelFromPromptLabel(currentPromptResult.fieldName)
        ?? extractModelFromPromptLabel(refinedPromptField)
        ?? extractModelFromPromptLabel(originalPromptResult.fieldName)
        ?? fieldMap.get('Text model')
        ?? fieldMap.get('Text Model')
        ?? fieldMap.get('Model');
    const imageModelHint = fieldMap.get('Image model')
        ?? fieldMap.get('Image Model')
        ?? extractModelFromQualityField(fieldMap.get('Quality'));
    return {
        context: {
            prompt: normalizedPrompt,
            originalPrompt: normalizedOriginal,
            refinedPrompt: normalizedRefined,
            textModel: parseTextModel(textModelHint),
            imageModel: parseImageModel(imageModelHint),
            size,
            aspectRatio,
            aspectRatioLabel: ASPECT_RATIO_LABELS[aspectRatio],
            quality: parseQuality(fieldMap.get('Quality')),
            background: parseBackground(fieldMap.get('Background')),
            style: parseStyle(fieldMap.get('Style')),
            allowPromptAdjustment: parsePromptAdjustment(fieldMap.get('Prompt adjustment') ?? fieldMap.get('Prompt Adjustment'))
        },
        responseId: parseIdentifier(fieldMap.get('Output ID')),
        inputId: parseIdentifier(fieldMap.get('Input ID'))
    };
}
export async function recoverContextFromMessage(message) {
    const recovered = await recoverContextDetailsFromMessage(message);
    return recovered ? recovered.context : null;
}
export async function recoverContextDetailsFromMessage(message) {
    // Track every message we inspect so we can both avoid infinite loops when
    // walking reply chains and prefer those messages during nearby lookups if
    // we still cannot find the embed payload.
    const visitedMessages = [];
    const visitedIds = new Set();
    let current = message;
    while (current && !visitedIds.has(current.id)) {
        visitedIds.add(current.id);
        visitedMessages.push(current);
        const direct = buildContextFromEmbed(current);
        if (direct) {
            return direct;
        }
        // Some conversational replies point at the bot's follow-up commentary
        // instead of the original embed. If this message references another
        // message, walk that chain before we fall back to broader history
        // lookups.
        const parentChannel = current.channel ?? null;
        if (!parentChannel) {
            break;
        }
        const referencedId = current.reference?.messageId ?? null;
        if (!referencedId) {
            break;
        }
        try {
            current = await parentChannel.messages.fetch(referencedId);
        }
        catch (error) {
            logger.debug('Failed to fetch referenced message while rebuilding image context:', error);
            break;
        }
    }
    const anchorMessage = visitedMessages[visitedMessages.length - 1] ?? message;
    const channel = anchorMessage.channel ?? message.channel;
    const clientUserId = anchorMessage.client.user?.id ?? message.client.user?.id;
    if (!channel || !clientUserId) {
        return null;
    }
    try {
        // Users frequently reply to the textual commentary that follows an embed
        // or to nearby bot messages. Walk a small window around the anchor
        // message (typically the original embed or the closest parent in the
        // reply chain) so we can recover the intended context without scanning
        // the entire channel history.
        const surrounding = await Promise.all([
            channel.messages.fetch({ before: anchorMessage.id, limit: NEARBY_SEARCH_LIMIT }),
            channel.messages.fetch({ after: anchorMessage.id, limit: Math.min(NEARBY_SEARCH_LIMIT, 5) })
        ]);
        const candidateMap = new Map();
        for (const visited of visitedMessages) {
            candidateMap.set(visited.id, visited);
        }
        for (const candidate of surrounding[0].values()) {
            candidateMap.set(candidate.id, candidate);
        }
        for (const candidate of surrounding[1].values()) {
            candidateMap.set(candidate.id, candidate);
        }
        const candidates = Array.from(candidateMap.values()).filter(candidate => candidate.author?.id === clientUserId);
        candidates.sort((a, b) => {
            const anchorTimestamp = anchorMessage.createdTimestamp;
            const aBeforeAnchor = a.createdTimestamp <= anchorTimestamp;
            const bBeforeAnchor = b.createdTimestamp <= anchorTimestamp;
            if (aBeforeAnchor && !bBeforeAnchor) {
                return -1;
            }
            if (!aBeforeAnchor && bBeforeAnchor) {
                return 1;
            }
            const distanceA = Math.abs(a.createdTimestamp - anchorTimestamp);
            const distanceB = Math.abs(b.createdTimestamp - anchorTimestamp);
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
    }
    catch (error) {
        logger.debug('Failed to recover context from nearby messages:', error);
    }
    return null;
}
//# sourceMappingURL=contextResolver.js.map