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
}
else if (parsed) {
    logger.debug(`Loaded environment variables: ${Object.keys(parsed).join(', ')}`);
}
// Required environment variables
const REQUIRED_ENV_VARS = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'OPENAI_API_KEY'
];
// Validate required environment variables
for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}
export const config = {
    // Bot configuration
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    openaiApiKey: process.env.OPENAI_API_KEY,
    // Environment
    env: process.env.NODE_ENV,
    isProduction: process.env.NODE_ENV === 'production'
};
//# sourceMappingURL=env.js.map