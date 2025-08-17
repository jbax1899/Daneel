import { Client } from 'discord.js';
import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';
import { Event } from '../events/Event.js';

export class EventManager {
  private events: Event[] = [];

  constructor(private client: Client) {}

  async loadEvents(eventsPath: string): Promise<void> {
    try {
      const eventFiles = (await readdir(eventsPath))
        .filter(file => {
          const isJsFile = file.endsWith('.js') || file.endsWith('.ts');
          const isNotBaseFile = !file.endsWith('Event.ts') && !file.endsWith('Event.js');
          return isJsFile && isNotBaseFile;
        });

      for (const file of eventFiles) {
        try {
          const filePath = path.join(eventsPath, file);
          const fileUrl = new URL(`file://${filePath}`).href;
          const { default: EventClass } = await import(fileUrl);
          
          if (EventClass && EventClass.prototype instanceof Event) {
            this.events.push(new EventClass());
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
