import type { ImageQualityType, ImageRenderModel } from '../commands/image/types.js';
/**
 * Represents the configurable settings for a token bucket. The manager keeps
 * everything in memory for now, but the abstraction makes it easy to swap in a
 * different persistence layer once we start tracking additional modalities.
 */
interface UsageTokenManagerOptions {
    tokensPerInterval: number;
    intervalMs: number;
    namespace?: string;
}
export interface TokenSnapshot {
    tokens: number;
    nextRefreshAt: number;
    refreshInSeconds: number;
}
export interface TokenSpendResult extends TokenSnapshot {
    allowed: boolean;
    cost: number;
    remainingTokens: number;
    neededTokens?: number;
}
/**
 * Lightweight token bucket manager that can service multiple feature scopes.
 * We only persist in memory today, but callers receive structured state so we
 * can later serialise to Redis or a database without touching call sites.
 */
export declare class UsageTokenManager {
    private readonly options;
    private readonly buckets;
    constructor(options: UsageTokenManagerOptions);
    /**
     * Returns a snapshot of the caller's current balance without modifying it.
     */
    inspect(key: string): TokenSnapshot;
    /**
     * Attempts to spend the requested amount of tokens. When insufficient
     * balance is available, the caller receives the remaining balance and a
     * countdown describing when to try again.
     */
    consume(key: string, cost: number): TokenSpendResult;
    /**
     * Refunds tokens after an unsuccessful attempt. Balances never exceed the
     * configured per-interval maximum so accidental double refunds are bounded.
     */
    refund(key: string, amount: number): TokenSnapshot;
    private namespacedKey;
    private ensureBucket;
    private buildSnapshot;
}
export declare const IMAGE_TOKEN_REFRESH_INTERVAL_MS: number;
export declare const IMAGE_TOKENS_PER_REFRESH = 10;
/**
 * Token multipliers let us represent the heavier footprint of the full render
 * model without rewriting every call site. Administrators can tweak these
 * values to rebalance the economy without touching business logic.
 */
export declare const IMAGE_MODEL_TOKEN_MULTIPLIER: Record<ImageRenderModel, number>;
export declare function getImageTokenCost(quality: ImageQualityType, imageModel: ImageRenderModel): number;
export declare function consumeImageTokens(userId: string, quality: ImageQualityType, imageModel: ImageRenderModel): TokenSpendResult;
export declare function refundImageTokens(userId: string, qualityOrAmount: ImageQualityType | number, imageModel?: ImageRenderModel): TokenSnapshot;
export declare function inspectImageTokens(userId: string): TokenSnapshot;
export declare function describeTokenAvailability(quality: ImageQualityType, result: TokenSpendResult, imageModel: ImageRenderModel): string;
export declare function buildQualityTokenDescription(quality: ImageQualityType, imageModel: ImageRenderModel): string;
export declare function buildModelTokenDescription(imageModel: ImageRenderModel, quality: ImageQualityType): string;
export declare function buildTokenSummaryLine(userId: string): string;
export {};
