import type { ImageBackgroundType, ImageQualityType, ImageResponseModel, ImageSizeType, ImageStylePreset } from './types.js';

/**
 * Represents the minimum data needed to recreate an image generation request.
 * This is stored so that we can re-run variations without asking the user to
 * manually re-enter every option.
 */
export interface ImageGenerationContext {
    prompt: string;
    model: ImageResponseModel;
    size: ImageSizeType;
    aspectRatio: 'auto' | 'square' | 'portrait' | 'landscape';
    aspectRatioLabel: string;
    quality: ImageQualityType;
    qualityRestricted: boolean;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    allowPromptAdjustment: boolean;
    authorUserId: string;
    authorGuildId?: string | null;
}

interface FollowUpCacheEntry {
    context: ImageGenerationContext;
    expiresAt: number;
    timeout: NodeJS.Timeout;
}

const DEFAULT_FOLLOW_UP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const followUpCache = new Map<string, FollowUpCacheEntry>();

/**
 * Stores a follow-up context for later retrieval. Existing entries with the
 * same key are replaced and their eviction timers cleared.
 */
export function saveFollowUpContext(
    responseId: string,
    context: ImageGenerationContext,
    ttlMs: number = DEFAULT_FOLLOW_UP_TTL_MS
): void {
    const existing = followUpCache.get(responseId);
    if (existing) {
        clearTimeout(existing.timeout);
    }

    const expiresAt = Date.now() + ttlMs;
    const timeout = setTimeout(() => {
        followUpCache.delete(responseId);
    }, ttlMs);

    followUpCache.set(responseId, { context, expiresAt, timeout });
}

/**
 * Retrieves a cached follow-up context if it has not expired yet. Expired
 * entries are removed and `null` is returned.
 */
export function readFollowUpContext(responseId: string): ImageGenerationContext | null {
    const entry = followUpCache.get(responseId);
    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        clearTimeout(entry.timeout);
        followUpCache.delete(responseId);
        return null;
    }

    return entry.context;
}

/**
 * Forcefully evicts a cached follow-up context. This is helpful when a
 * variation chain needs to move from one response ID to the next.
 */
export function evictFollowUpContext(responseId: string): void {
    const entry = followUpCache.get(responseId);
    if (!entry) {
        return;
    }

    clearTimeout(entry.timeout);
    followUpCache.delete(responseId);
}

export { DEFAULT_FOLLOW_UP_TTL_MS };
