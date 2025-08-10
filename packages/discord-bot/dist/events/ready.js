import { ActivityType } from 'discord.js';
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
export default class ReadyEvent extends Event {
    constructor() {
        super({
            name: 'ready',
            once: true,
        });
    }
    async execute(client) {
        if (!client.user) {
            throw new Error('Client user is not available');
        }
        logger.info(`Logged in as ${client.user.tag}`);
        logger.info(`Bot is in ${client.guilds.cache.size} guild(s)`);
        // Set bot's activity status
        client.user.setActivity({
            name: 'with TypeScript',
            type: ActivityType.Playing,
        });
        // Log all guilds the bot is in (for debugging)
        client.guilds.cache.forEach((guild) => {
            logger.info(`Guild: ${guild.name} (${guild.id})`);
        });
    }
}
//# sourceMappingURL=ready.js.map