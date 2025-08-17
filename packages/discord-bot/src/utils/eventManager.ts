import { Client } from 'discord.js';
import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';
import { Event } from '../events/Event.js';

export class EventManager {
  private events: Event[] = [];
  private dependencies: Record<string, any>;

  constructor(private client: Client, dependencies: Record<string, any> = {}) {
    this.dependencies = dependencies;
  }

  async loadEvents(eventsPath: string): Promise<void> {
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
            } catch (error) {
              logger.error(`Failed to instantiate event from ${file}:`, error);
            }
          } else {
            logger.warn(`Skipping ${file} - no valid event class found`);
            logger.debug('Module exports:', Object.keys(module));
          }
        } catch (error) {
          logger.error(`Error loading event from ${file}:`, error);
        }
      }

      logger.info(`Successfully loaded ${this.events.length} events.`);
    } catch (error) {
      logger.error('Failed to load events:', error);
      throw error;
    }
  }

  registerAll(): void {
    this.events.forEach(event => {
      event.register(this.client);
      logger.debug(`Registered event: ${event.name} (${event.once ? 'once' : 'on'})`);
    });
  }

  getEventCount(): number {
    return this.events.length;
  }
}
