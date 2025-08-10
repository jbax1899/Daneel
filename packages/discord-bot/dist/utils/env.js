import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables from .env file in the root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Basic validation for required environment variables
if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is not defined in the environment variables');
}
// Set default NODE_ENV if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
export const config = {
    token: process.env.DISCORD_TOKEN,
    env: process.env.NODE_ENV
};
//# sourceMappingURL=env.js.map