/**
 * @file RateLimiter.ts
 * @description Handles rate limiting for Discord interactions.
 * Provides per-user, per-channel, and per-guild rate limiting with configurable windows.
 */
type RateLimitScope = 'user' | 'channel' | 'guild';
interface RateLimitOptions {
    limit: number;
    window: number;
    scope: RateLimitScope;
    errorMessage?: string;
}
/**
 * Handles rate limiting for Discord interactions.
 * Supports different scopes (user, channel, guild) with configurable limits and time windows.
 * @class RateLimiter
 */
export declare class RateLimiter {
    private readonly limits;
    private readonly options;
    private readonly lastImageGenerationByUser;
    /**
     * Creates a new RateLimiter instance.
     * @param {RateLimitOptions} options - Configuration options for the rate limiter
     */
    constructor(options: RateLimitOptions);
    /**
     * Gets a unique key for the rate limit based on scope and ID.
     * @private
     */
    private getKey;
    /**
     * Checks if a request is allowed based on the rate limit rules.
     * @param {string} userId - The ID of the user making the request
     * @param {string} channelId - The ID of the channel where the request was made
     * @param {string} guildId - The ID of the guild where the request was made
     * @returns {{allowed: boolean, retryAfter?: number, error?: string}} Result of the rate limit check
     */
    check(userId: string, channelId: string, guildId?: string): {
        allowed: boolean;
        retryAfter?: number;
        error?: string;
    };
    /**
     * Checks if a request to generate an image (/image) is allowed based on the rate limit rules.
     * @param {string} userId - The ID of the user making the request
     * @returns {{allowed: boolean, retryAfter?: number, error?: string}} Result of the rate limit check
     */
    checkRateLimitImageCommand(userId: string): {
        allowed: boolean;
        retryAfter?: number;
        error?: string;
    };
    /**
     * Gets the appropriate scope ID based on the rate limiter's scope.
     * @private
     */
    private getScopeId;
    /**
     * Clears expired rate limit records.
     * Should be called periodically to prevent memory leaks.
     */
    cleanup(): void;
}
/**
 * Creates a pre-configured rate limiter for user-level rate limiting.
 * @param limit - Maximum requests allowed
 * @param window - Time window in milliseconds
 * @returns A RateLimiter instance configured for user-level limiting
 */
export declare function createUserRateLimiter(limit: number, window: number): RateLimiter;
/**
 * Creates a pre-configured rate limiter for channel-level rate limiting.
 * @param limit - Maximum requests allowed
 * @param window - Time window in milliseconds
 * @returns A RateLimiter instance configured for channel-level limiting
 */
export declare function createChannelRateLimiter(limit: number, window: number): RateLimiter;
/**
 * Creates a pre-configured rate limiter for guild-level rate limiting.
 * @param limit - Maximum requests allowed
 * @param window - Time window in milliseconds
 * @returns A RateLimiter instance configured for guild-level limiting
 */
export declare function createGuildRateLimiter(limit: number, window: number): RateLimiter;
export declare const imageCommandRateLimiter: RateLimiter;
export {};
