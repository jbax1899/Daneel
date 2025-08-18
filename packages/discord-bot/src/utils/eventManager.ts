/**
 * @file eventManager.ts
 * @description Manages loading and handling Discord.js events.
 * Handles dynamic loading of event handlers and binding them to Discord client events.
 */

import { Client } from 'discord.js';
import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';
import { Event } from '../events/Event.js';

/**
 * Manages Discord.js events for the bot.
 * Handles dynamic loading of event handlers and binding them to Discord client events.
 * @class EventManager
 */
export class EventManager {
  /** Collection of loaded event handlers */
  private events: Event[] = [];
  
  /** Dependencies to be injected into event handlers */
  private dependencies: Record<string, any>;

  /**
   * Creates an instance of EventManager.
   * @param {Client} client - The Discord.js client instance
   * @param {Record<string, any>} [dependencies={}] - Dependencies to inject into event handlers
   */
  constructor(private client: Client, dependencies: Record<string, any> = {}) {
    this.dependencies = dependencies;
  }

  /**
   * Loads event handlers from the specified directory.
   * @async
   * @param {string} eventsPath - Path to the directory containing event handlers
   * @returns {Promise<void>}
   * @throws {Error} If there's an error loading events
   */
  async loadEvents(eventsPath: string): Promise<void> {
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
            } catch (error) {
              logger.error(`Failed to instantiate event from ${file}:`, error);
            }
          } else {
            logger.warn(`Skipping ${file}: No valid event class found`);
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

  /**
   * Registers all loaded events with the Discord client.
   * Ensures each event is only registered once to prevent duplicates.
   */
  public registerAll(): void {
    const registeredEvents = new Set<string>();
    
    for (const event of this.events) {
      // Skip if this event name has already been registered
      if (registeredEvents.has(event.name)) {
        logger.warn(`Skipping duplicate registration for event: ${event.name}`);
        continue;
      }
      
      // Register the event
      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args));
      } else {
        this.client.on(event.name, (...args) => event.execute(...args));
      }
      
      // Track that we've registered this event name
      registeredEvents.add(event.name);
      logger.debug(`Registered event: ${event.name} (${event.once ? 'once' : 'on'})`);
    }

    logger.info(`Registered ${this.events.length} events.`);
  }

  /**
   * Gets the number of loaded events.
   * @returns {number} Number of loaded events
   */
  getEventCount(): number {
    return this.events.length;
  }
}
