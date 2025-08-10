import { Collection } from 'discord.js';
import { Command } from '../commands/BaseCommand';

declare module 'discord.js' {
  export interface Client<Ready extends boolean = boolean> {
    commands: Collection<string, Command>;
  }
}
