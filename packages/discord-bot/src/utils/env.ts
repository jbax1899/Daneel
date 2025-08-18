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
const { error, parsed } = dotenv.config({ path: envPath });

if (error) {
  logger.warn(`Failed to load .env file: ${error.message}`);
} else if (parsed) {
  logger.debug(`Loaded environment variables: ${Object.keys(parsed).join(', ')}`);
}

/**
 * List of required environment variables that must be set for the application to run.
 * @type {readonly string[]}
 */
const REQUIRED_ENV_VARS = [
  'DISCORD_TOKEN',    // Discord bot token for authentication
  'CLIENT_ID',        // Discord application client ID
  'GUILD_ID',         // Discord server (guild) ID
  'OPENAI_API_KEY'    // OpenAI API key for AI functionality
] as const;

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
}

// Validate environment variables on startup
validateEnvironment();

/**
 * Application configuration object containing all environment-based settings.
 * @type {Object}
 * @property {string} token - Discord bot token
 * @property {string} clientId - Discord application client ID
 * @property {string} guildId - Discord server (guild) ID
 * @property {string} openaiApiKey - OpenAI API key
 * @property {string|undefined} env - Current environment (e.g., 'development', 'production')
 * @property {boolean} isProduction - Whether the current environment is production
 */
export const config = {
  // Bot configuration
  token: process.env.DISCORD_TOKEN!,
  clientId: process.env.CLIENT_ID!,
  guildId: process.env.GUILD_ID!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  
  // Environment
  env: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production'
} as const;