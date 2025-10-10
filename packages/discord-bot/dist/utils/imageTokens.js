import { logger } from './logger.js';
/**
 * Lightweight token bucket manager that can service multiple feature scopes.
 * We only persist in memory today, but callers receive structured state so we
 * can later serialise to Redis or a database without touching call sites.
 */
export class UsageTokenManager {
    options;
    buckets = new Map();
    constructor(options) {
        this.options = options;
    }
    /**
     * Returns a snapshot of the caller's current balance without modifying it.
     */
    inspect(key) {
        const bucket = this.ensureBucket(key);
        return this.buildSnapshot(bucket);
    }
    /**
     * Attempts to spend the requested amount of tokens. When insufficient
     * balance is available, the caller receives the remaining balance and a
     * countdown describing when to try again.
     */
    consume(key, cost) {
        if (cost <= 0 || !Number.isFinite(cost)) {
            logger.warn(`Ignoring invalid token cost (${cost}) for key ${this.namespacedKey(key)}.`);
            const bucket = this.ensureBucket(key);
            return {
                ...this.buildSnapshot(bucket),
                allowed: true,
                cost: 0,
                remainingTokens: bucket.tokens
            };
        }
        const bucket = this.ensureBucket(key);
        if (bucket.tokens < cost) {
            const neededTokens = cost - bucket.tokens;
            return {
                ...this.buildSnapshot(bucket),
                allowed: false,
                cost,
                remainingTokens: bucket.tokens,
                neededTokens
            };
        }
        bucket.tokens -= cost;
        return {
            ...this.buildSnapshot(bucket),
            allowed: true,
            cost,
            remainingTokens: bucket.tokens
        };
    }
    /**
     * Refunds tokens after an unsuccessful attempt. Balances never exceed the
     * configured per-interval maximum so accidental double refunds are bounded.
     */
    refund(key, amount) {
        if (amount <= 0 || !Number.isFinite(amount)) {
            return this.inspect(key);
        }
        const bucket = this.ensureBucket(key);
        bucket.tokens = Math.min(bucket.tokens + amount, this.options.tokensPerInterval);
        return this.buildSnapshot(bucket);
    }
    namespacedKey(key) {
        return this.options.namespace ? `${this.options.namespace}:${key}` : key;
    }
    ensureBucket(key) {
        const now = Date.now();
        const namespacedKey = this.namespacedKey(key);
        let bucket = this.buckets.get(namespacedKey);
        if (!bucket) {
            bucket = {
                tokens: this.options.tokensPerInterval,
                nextRefreshAt: now + this.options.intervalMs
            };
            this.buckets.set(namespacedKey, bucket);
            return bucket;
        }
        if (now >= bucket.nextRefreshAt) {
            // Advance the refresh window so long offline periods do not stall.
            const intervalsElapsed = Math.floor((now - bucket.nextRefreshAt) / this.options.intervalMs) + 1;
            bucket.tokens = this.options.tokensPerInterval;
            bucket.nextRefreshAt = bucket.nextRefreshAt + intervalsElapsed * this.options.intervalMs;
        }
        return bucket;
    }
    buildSnapshot(bucket) {
        const now = Date.now();
        return {
            tokens: bucket.tokens,
            nextRefreshAt: bucket.nextRefreshAt,
            refreshInSeconds: Math.max(0, Math.ceil((bucket.nextRefreshAt - now) / 1000))
        };
    }
}
export const IMAGE_TOKEN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const IMAGE_TOKENS_PER_REFRESH = 10;
const QUALITY_TOKEN_COST = {
    auto: 1,
    low: 1,
    medium: 3,
    high: 5
};
/**
 * Token multipliers let us represent the heavier footprint of the full render
 * model without rewriting every call site. Administrators can tweak these
 * values to rebalance the economy without touching business logic.
 */
export const IMAGE_MODEL_TOKEN_MULTIPLIER = {
    'gpt-image-1-mini': 1,
    'gpt-image-1': 2
};
const imageTokenManager = new UsageTokenManager({
    tokensPerInterval: IMAGE_TOKENS_PER_REFRESH,
    intervalMs: IMAGE_TOKEN_REFRESH_INTERVAL_MS,
    namespace: 'image'
});
export function getImageTokenCost(quality, imageModel) {
    const baseCost = QUALITY_TOKEN_COST[quality] ?? QUALITY_TOKEN_COST.low;
    const multiplier = IMAGE_MODEL_TOKEN_MULTIPLIER[imageModel] ?? 1;
    return baseCost * multiplier;
}
export function consumeImageTokens(userId, quality, imageModel) {
    const cost = getImageTokenCost(quality, imageModel);
    return imageTokenManager.consume(userId, cost);
}
export function refundImageTokens(userId, qualityOrAmount, imageModel = 'gpt-image-1-mini') {
    const amount = typeof qualityOrAmount === 'number'
        ? qualityOrAmount
        : getImageTokenCost(qualityOrAmount, imageModel);
    return imageTokenManager.refund(userId, amount);
}
export function inspectImageTokens(userId) {
    return imageTokenManager.inspect(userId);
}
export function describeTokenAvailability(quality, result, imageModel) {
    const qualityName = quality.charAt(0).toUpperCase() + quality.slice(1);
    const countdown = formatCountdown(result.refreshInSeconds);
    const neededText = result.neededTokens && result.neededTokens > 0
        ? `You need ${result.neededTokens} more token${result.neededTokens === 1 ? '' : 's'} to proceed.`
        : '';
    const waitInstruction = result.remainingTokens === 0
        ? `Please wait ${countdown} for your balance to refresh.`
        : `Please wait ${countdown} or pick a lower quality.`;
    return `⚠️ ${qualityName} quality with ${imageModel} requires ${result.cost} token${result.cost === 1 ? '' : 's'}, but you have ${result.remainingTokens}. ${waitInstruction} ${neededText}`.trim();
}
export function buildQualityTokenDescription(quality, imageModel) {
    const cost = getImageTokenCost(quality, imageModel);
    return `Uses ${cost} token${cost === 1 ? '' : 's'}`;
}
export function buildModelTokenDescription(imageModel, quality) {
    const qualityName = quality.charAt(0).toUpperCase() + quality.slice(1);
    const cost = getImageTokenCost(quality, imageModel);
    return `${qualityName} quality uses ${cost} token${cost === 1 ? '' : 's'}`;
}
export function buildTokenSummaryLine(userId) {
    const snapshot = inspectImageTokens(userId);
    const countdown = formatCountdown(snapshot.refreshInSeconds);
    const parts = [`Tokens remaining: ${snapshot.tokens}`, `Refreshes in: ${countdown}`];
    return parts.join(' • ');
}
function formatCountdown(seconds) {
    if (seconds <= 0) {
        return 'now';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const minutesRemainder = minutes % 60;
        if (minutesRemainder === 0 && remainingSeconds === 0) {
            return `${hours}h`;
        }
        if (remainingSeconds === 0) {
            return `${hours}h${minutesRemainder}m`;
        }
        return `${hours}h${minutesRemainder}m${remainingSeconds}s`;
    }
    if (minutes > 0 && remainingSeconds > 0) {
        return `${minutes}m${remainingSeconds}s`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${remainingSeconds}s`;
}
//# sourceMappingURL=imageTokens.js.map