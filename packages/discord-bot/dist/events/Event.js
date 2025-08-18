/**
 * @file Event.ts
 * @description Base event class for Discord.js events with robust error handling and registration.
 * This provides a foundation for all Discord.js event handlers in the application.
 */
import { logger } from '../utils/logger.js';
/**
 * Abstract base class for Discord.js event handlers.
 * Provides consistent error handling and event registration.
 * @abstract
 * @class Event
 */
export class Event {
    /** The name of the Discord.js event to listen for */
    name;
    /** Whether the event should only be handled once */
    once;
    /**
     * Creates an instance of Event.
     * @param {Object} options - Configuration options for the event
     * @param {keyof ClientEvents} options.name - The name of the Discord.js event
     * @param {boolean} [options.once=false] - If true, the event will only be handled once
     */
    constructor(options) {
        this.name = options.name;
        this.once = options.once ?? false;
    }
    /**
     * Registers the event with the Discord.js client.
     * @param {Client} client - The Discord.js client instance
     */
    register(client) {
        try {
            if (this.once) {
                client.once(this.name, this._execute.bind(this));
            }
            else {
                client.on(this.name, this._execute.bind(this));
            }
            logger.debug(`Registered event: ${this.name} (${this.once ? 'once' : 'on'})`);
        }
        catch (error) {
            logger.error(`Failed to register event ${this.name}:`, error);
            throw error;
        }
    }
    /**
     * Wraps the execute method with error handling.
     * @private
     * @param {...any[]} args - Arguments passed by the Discord.js client
     */
    async _execute(...args) {
        try {
            await this.execute(...args);
        }
        catch (error) {
            logger.error(`Error in event ${this.name}:`, error);
            // Optionally handle the error or rethrow
            throw error;
        }
    }
}
//# sourceMappingURL=Event.js.map