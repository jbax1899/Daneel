/**
 * @file discord.d.ts
 * @description TypeScript type declarations for Discord.js extensions
 * Extends the base Discord.js types with custom application-specific types.
 */

import { Collection, Client as DiscordClient } from 'discord.js';
import { Command } from '../commands/BaseCommand';
import { Event } from '../events/Event';

declare module 'discord.js' {
  /**
   * Extended Discord.js Client interface with custom properties
   * @template Ready - Whether the client is ready (boolean literal type)
   */
  export interface Client<Ready extends boolean = boolean> extends DiscordClient<Ready> {
    /**
     * Collection of registered commands, mapped by command name
     */
    commands: Collection<string, Command>;
    
    /**
     * Map of event handlers, mapped by handler name
     */
    handlers: Collection<string, any>;
  }
}
