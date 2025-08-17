/**
 * Base event class for Discord.js events with error handling and registration
 */
import { logger } from '../utils/logger.js';
/** Base class for Discord.js event handlers */
export class Event {
    name;
    once;
    constructor(options) {
        this.name = options.name;
        this.once = options.once ?? false;
    }
    /** Register this event with a Discord client */
    register(client) {
        if (this.once) {
            client.once(this.name, this._execute.bind(this));
        }
        else {
            client.on(this.name, this._execute.bind(this));
        }
    }
    // Wraps execute() with error handling
    async _execute(...args) {
        try {
            await this.execute(...args);
        }
        catch (error) {
            logger.error(`Error in event ${this.name}:`, error);
        }
    }
}
//# sourceMappingURL=Event.js.map