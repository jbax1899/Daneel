import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { Event } from '../events/Event.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/env.js';

import ReadyEvent from '../events/ready.js';
import MessageCreateEvent from '../events/messageCreate.js';

export class Bot extends Client {
  private events: Collection<string, Event> = new Collection();
  private isProduction = config.env === 'production';

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.registerEvents();
  }

  private registerEvents() {
    // Register events here
    this.registerEvent(new ReadyEvent());
    this.registerEvent(new MessageCreateEvent());
  }

  public registerEvent(event: Event) {
    this.events.set(event.name, event);
    event.register(this);
    logger.debug(`Registered event: ${event.name}`);
  }

  public async start() {
    try {
      logger.info(`Starting bot in ${config.env} mode...`);
      await this.login(config.token);
      logger.info('Bot is connected to Discord');
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }
}
