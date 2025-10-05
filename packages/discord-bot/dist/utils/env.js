/**
 * @file env.ts
 * @description Environment variable configuration and validation for the Discord bot.
 * Handles loading environment variables from .env file and validating required configurations.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Calculate .env file path
const envPath = path.resolve(__dirname, '../../../../.env');
logger.debug(`Loading environment variables from: ${envPath}`);
// Load environment variables from .env file in the root directory
try {
    const { error, parsed } = dotenv.config({ path: envPath });
    if (error) {
        logger.warn(`Failed to load .env file: ${error.message}`);
    }
    else if (parsed) {
        logger.debug(`Loaded environment variables: ${Object.keys(parsed).join(', ')}`);
    }
}
catch {
    logger.warn("No .env found (expected on Fly.io deployments)");
}
/**
 * List of required environment variables that must be set for the application to run.
 * @type {readonly string[]}
 */
const REQUIRED_ENV_VARS = [
    'DISCORD_TOKEN', // Discord bot token for authentication
    'CLIENT_ID', // Discord application client ID
    'GUILD_ID', // Discord server (guild) ID
    'OPENAI_API_KEY', // OpenAI API key for AI functionality
    'DEVELOPER_USER_ID' // Discord user ID of the developer for privileged access
];
/**
 * Default rate limit configurations
 */
const DEFAULT_RATE_LIMITS = {
    // Per-user: 5 messages per minute
    USER_LIMIT: 5,
    USER_WINDOW_MS: 60_000,
    // Per-channel: 10 messages per minute
    CHANNEL_LIMIT: 10,
    CHANNEL_WINDOW_MS: 60_000,
    // Per-guild: 20 messages per minute
    GUILD_LIMIT: 20,
    GUILD_WINDOW_MS: 60_000,
    // Whether to enable each type of rate limiting
    RATE_LIMIT_USER: 'true',
    RATE_LIMIT_CHANNEL: 'true',
    RATE_LIMIT_GUILD: 'true'
};
/**
 * Validates that all required environment variables are set.
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }
    // Log set rate limits
    logger.debug(`Rate limits: ${JSON.stringify(DEFAULT_RATE_LIMITS)}`);
}
// Validate environment variables on startup
validateEnvironment();
/**
 * Gets a number from environment variables with a default value
 */
function getNumberEnv(key, defaultValue) {
    const value = process.env[key];
    return value ? Number(value) : defaultValue;
}
/**
 * Gets a boolean from environment variables with a default value
 */
function getBooleanEnv(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
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
export const config = {
    // Bot configuration
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    openaiApiKey: process.env.OPENAI_API_KEY,
    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction: (process.env.NODE_ENV || 'development') === 'production',
    // Rate limiting configuration
    rateLimits: {
        user: {
            enabled: getBooleanEnv('RATE_LIMIT_USER', DEFAULT_RATE_LIMITS.RATE_LIMIT_USER === 'true'),
            limit: getNumberEnv('USER_RATE_LIMIT', DEFAULT_RATE_LIMITS.USER_LIMIT),
            windowMs: getNumberEnv('USER_RATE_WINDOW_MS', DEFAULT_RATE_LIMITS.USER_WINDOW_MS)
        },
        channel: {
            enabled: getBooleanEnv('RATE_LIMIT_CHANNEL', DEFAULT_RATE_LIMITS.RATE_LIMIT_CHANNEL === 'true'),
            limit: getNumberEnv('CHANNEL_RATE_LIMIT', DEFAULT_RATE_LIMITS.CHANNEL_LIMIT),
            windowMs: getNumberEnv('CHANNEL_RATE_WINDOW_MS', DEFAULT_RATE_LIMITS.CHANNEL_WINDOW_MS)
        },
        guild: {
            enabled: getBooleanEnv('RATE_LIMIT_GUILD', DEFAULT_RATE_LIMITS.RATE_LIMIT_GUILD === 'true'),
            limit: getNumberEnv('GUILD_RATE_LIMIT', DEFAULT_RATE_LIMITS.GUILD_LIMIT),
            windowMs: getNumberEnv('GUILD_RATE_WINDOW_MS', DEFAULT_RATE_LIMITS.GUILD_WINDOW_MS)
        }
    }
};
//# sourceMappingURL=env.js.map