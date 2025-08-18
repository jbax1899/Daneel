/**
 * @file eventManager.ts
 * @description Manages loading and handling Discord.js events.
 * Handles dynamic loading of event handlers and binding them to Discord client events.
 */
import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';
/**
 * Manages Discord.js events for the bot.
 * Handles dynamic loading of event handlers and binding them to Discord client events.
 * @class EventManager
 */
export class EventManager {
    client;
    /** Collection of loaded event handlers */
    events = [];
    /** Dependencies to be injected into event handlers */
    dependencies;
    /**
     * Creates an instance of EventManager.
     * @param {Client} client - The Discord.js client instance
     * @param {Record<string, any>} [dependencies={}] - Dependencies to inject into event handlers
     */
    constructor(client, dependencies = {}) {
        this.client = client;
        this.dependencies = dependencies;
    }
    /**
     * Loads event handlers from the specified directory.
     * @async
     * @param {string} eventsPath - Path to the directory containing event handlers
     * @returns {Promise<void>}
     * @throws {Error} If there's an error loading events
     */
    async loadEvents(eventsPath) {
        try {
            logger.debug(`Loading events from: ${eventsPath}`);
            // Filter for valid event files (JS/TS files, excluding base Event file)
            const eventFiles = (await readdir(eventsPath))
                .filter(file => {
                const isJsFile = file.endsWith('.js') || file.endsWith('.ts');
                const isNotBaseFile = file !== 'Event.ts' && file !== 'Event.js';
                return isJsFile && isNotBaseFile;
            });
            logger.debug(`Found ${eventFiles.length} event files in ${eventsPath}`);
            for (const file of eventFiles) {
                logger.debug(`Attempting to load event from: ${file}`);
                try {
                    // Use dynamic import with file path relative to the project root
                    const modulePath = `file://${path.resolve(eventsPath, file)}`;
                    const module = await import(modulePath);
                    // Get the default export or the first class that has an execute method
                    let EventClass = module.default;
                    // If no default export, look for a named export with the same name as the file
                    if (!EventClass) {
                        const className = file.replace(/\.(js|ts)$/, '');
                        EventClass = module[className];
                    }
                    // Check if we found a valid event class
                    if (typeof EventClass === 'function' && EventClass.prototype &&
                        typeof EventClass.prototype.execute === 'function') {
                        try {
                            const event = new EventClass(this.dependencies);
                            this.events.push(event);
                            logger.debug(`Successfully loaded event: ${file}`);
                        }
                        catch (error) {
                            logger.error(`Failed to instantiate event from ${file}:`, error);
                        }
                    }
                    else {
                        logger.warn(`Skipping ${file}: No valid event class found`);
                    }
                }
                catch (error) {
                    logger.error(`Error loading event from ${file}:`, error);
                }
            }
            logger.info(`Successfully loaded ${this.events.length} events.`);
        }
        catch (error) {
            logger.error('Failed to load events:', error);
            throw error;
        }
    }
    /**
     * Registers all loaded events with the Discord client.
     * @returns {void}
     */
    registerAll() {
        this.events.forEach(event => {
            event.register(this.client);
            logger.debug(`Registered event: ${event.name} (${event.once ? 'once' : 'on'})`);
        });
    }
    /**
     * Gets the number of loaded events.
     * @returns {number} Number of loaded events
     */
    getEventCount() {
        return this.events.length;
    }
}
//# sourceMappingURL=eventManager.js.map