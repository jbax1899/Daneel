const DEFAULT_FOLLOW_UP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const followUpCache = new Map();
/**
 * Stores a follow-up context for later retrieval. Existing entries with the
 * same key are replaced and their eviction timers cleared.
 */
export function saveFollowUpContext(responseId, context, ttlMs = DEFAULT_FOLLOW_UP_TTL_MS) {
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
export function readFollowUpContext(responseId) {
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
export function evictFollowUpContext(responseId) {
    const entry = followUpCache.get(responseId);
    if (!entry) {
        return;
    }
    clearTimeout(entry.timeout);
    followUpCache.delete(responseId);
}
export { DEFAULT_FOLLOW_UP_TTL_MS };
//# sourceMappingURL=followUpCache.js.map