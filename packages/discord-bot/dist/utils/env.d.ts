/**
 * @file env.ts
 * @description Environment variable configuration and validation for the Discord bot.
 * Handles loading environment variables from .env file and validating required configurations.
 */
/**
 * Application configuration object containing all environment-based settings.
 * @type {Object}
 * @property {string} token - Discord bot token
 * @property {string} clientId - Discord application client ID
 * @property {string} guildId - Discord server (guild) ID
 * @property {string} openaiApiKey - OpenAI API key
 * @property {string|undefined} env - Current environment (e.g., 'development', 'production')
 * @property {boolean} isProduction - Whether the current environment is production
 * @property {Object} rateLimits - Rate limiting configuration
 */
export declare const config: {
    readonly token: string;
    readonly clientId: string;
    readonly guildId: string;
    readonly openaiApiKey: string;
    readonly env: string;
    readonly isProduction: boolean;
    readonly rateLimits: {
        readonly user: {
            readonly enabled: boolean;
            readonly limit: number;
            readonly windowMs: number;
        };
        readonly channel: {
            readonly enabled: boolean;
            readonly limit: number;
            readonly windowMs: number;
        };
        readonly guild: {
            readonly enabled: boolean;
            readonly limit: number;
            readonly windowMs: number;
        };
    };
};
