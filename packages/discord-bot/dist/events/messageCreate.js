import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
export default class MessageCreateEvent extends Event {
    prefix = '!';
    constructor() {
        super({
            name: 'messageCreate',
        });
    }
    async execute(message) {
        // Ignore messages from bots and messages without the command prefix
        if (message.author.bot || !message.content.startsWith(this.prefix))
            return;
        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();
        if (!command)
            return;
        logger.info(`Command received: ${command} from ${message.author.tag}`);
        try {
            switch (command) {
                case 'ping':
                    if (message.channel.isTextBased() && !message.channel.isDMBased()) {
                        await message.channel.send('Pong!');
                    }
                    break;
                // Add more commands here
                default:
                    // Command not found
                    break;
            }
        }
        catch (error) {
            logger.error(`Error executing command ${command}:`, error);
            if (message.channel.isTextBased() && !message.channel.isDMBased()) {
                await message.channel.send('An error occurred while executing that command.');
            }
        }
    }
}
//# sourceMappingURL=messageCreate.js.map