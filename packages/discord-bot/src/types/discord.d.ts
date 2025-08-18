/**
 * @file discord.d.ts
 * @description TypeScript type declarations for Discord.js extensions
 * Extends the base Discord.js types with custom application-specific types.
 */

import { Collection } from 'discord.js';
import { Command } from '../commands/BaseCommand';

/**
 * Extends the Discord.js Client interface with custom properties
 * @module discord.js-extensions
 */
declare module 'discord.js' {
  /**
   * Extended Discord.js Client interface with custom properties
   * @template Ready - Whether the client is ready (boolean literal type)
   */
  export interface Client<Ready extends boolean = boolean> {
    /**
     * Collection of registered commands, mapped by command name
     * @type {Collection<string, Command>}
     */
    commands: Collection<string, Command>;
  }
}
