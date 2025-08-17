/**
 * Base event class for Discord.js events with error handling and registration
 */

import { Client, ClientEvents } from 'discord.js';
import { logger } from '../utils/logger.js';

/** Structure of an event handler */
export interface IEvent {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

/** Base class for Discord.js event handlers */
export abstract class Event implements IEvent {
  public name: keyof ClientEvents;
  public once: boolean;

  constructor(options: { name: keyof ClientEvents; once?: boolean }) {
    this.name = options.name;
    this.once = options.once ?? false;
  }

  /** Main execution method to be implemented by subclasses */
  public abstract execute(...args: any[]): Promise<void> | void;

  /** Register this event with a Discord client */
  public register(client: Client): void {
    if (this.once) {
      client.once(this.name, this._execute.bind(this));
    } else {
      client.on(this.name, this._execute.bind(this));
    }
  }

  // Wraps execute() with error handling
  private async _execute(...args: any[]): Promise<void> {
    try {
      await this.execute(...args);
    } catch (error) {
      logger.error(`Error in event ${this.name}:`, error);
    }
  }
}
