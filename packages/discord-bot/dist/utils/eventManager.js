import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';
import { Event } from '../events/Event.js';
export class EventManager {
    client;
    events = [];
    dependencies;
    constructor(client, dependencies = {}) {
        this.client = client;
        this.dependencies = dependencies;
    }
    async loadEvents(eventsPath) {
        try {
            logger.debug(`Loading events from: ${eventsPath}`);
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
                    const filePath = path.join(eventsPath, file);
                    const fileUrl = new URL(`file://${filePath}`).href;
                    const { default: EventClass } = await import(fileUrl);
                    if (EventClass && EventClass.prototype instanceof Event) {
                        const event = new EventClass(this.dependencies);
                        this.events.push(event);
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
    registerAll() {
        this.events.forEach(event => {
            event.register(this.client);
            logger.debug(`Registered event: ${event.name} (${event.once ? 'once' : 'on'})`);
        });
    }
    getEventCount() {
        return this.events.length;
    }
}
//# sourceMappingURL=eventManager.js.map