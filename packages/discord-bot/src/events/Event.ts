import { Client, ClientEvents } from 'discord.js';
import { logger } from '../utils/logger.js';

export interface IEvent {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export abstract class Event implements IEvent {
  public name: keyof ClientEvents;
  public once: boolean;

  constructor(options: { name: keyof ClientEvents; once?: boolean }) {
    this.name = options.name;
    this.once = options.once ?? false;
  }

  public abstract execute(...args: any[]): Promise<void> | void;

  public register(client: Client): void {
    if (this.once) {
      client.once(this.name, this._execute.bind(this));
    } else {
      client.on(this.name, this._execute.bind(this));
    }
  }

  private async _execute(...args: any[]): Promise<void> {
    try {
      await this.execute(...args);
    } catch (error) {
      logger.error(`Error in event ${this.name}:`, error);
    }
  }
}
