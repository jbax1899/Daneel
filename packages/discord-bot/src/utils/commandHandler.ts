/**
 * @file commandHandler.ts
 * @description Handles deployment and registration of slash commands with the Discord API.
 * Manages command discovery, validation, and registration.
 */

import { REST, Routes, Collection } from 'discord.js';
import { Command } from '../commands/BaseCommand.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';

/** Path to the commands directory */
const commandsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../commands');

/**
 * Handles loading and managing Discord slash commands.
 * Responsible for discovering, validating, and registering commands with Discord's API.
 * @class CommandHandler
 */
export class CommandHandler {
  /** Collection of loaded commands, mapped by command name */
  private commands = new Collection<string, Command>();

  /**
   * Loads all command files from the commands directory.
   * @async
   * @returns {Promise<Collection<string, Command>>}
   * @throws {Error} If there's an error loading commands
   */
  async loadCommands(): Promise<Collection<string, Command>> {
    try {
      logger.debug('Loading commands...');

      // In development, we need to look in the src directory for .ts files
      const isDev = process.env.NODE_ENV !== 'production';
      const basePath = isDev ? path.join(process.cwd(), 'src/commands') : commandsPath;
      
      /**
       * Filters and loads command files based on environment
       * @type {string[]}
       */
      const commandFiles: string[] = (await readdir(basePath))
        .filter(file => {
          // In development, look for .ts files, in production look for .js files
          const isCorrectExtension = isDev ? file.endsWith('.ts') : file.endsWith('.js');
          const isNotDeclaration = !file.endsWith('.d.ts');
          const isNotBaseCommand = !file.includes('BaseCommand');
          return isCorrectExtension && isNotDeclaration && isNotBaseCommand;
        });

      logger.debug(`Found ${commandFiles.length} command files in ${basePath}`);

      for (const file of commandFiles) {
        try {
          const filePath = path.join(basePath, file);
          logger.debug(`Attempting to load command from: ${filePath}`);
          
          // Use dynamic import with file:// URL for Windows compatibility
          const fileUrl = new URL(`file://${filePath.replace(/\\/g, '/')}`);
          const { default: command } = await import(fileUrl.href);
          
          if (command?.data) {
            this.commands.set(command.data.name, command);
            logger.debug(`Loaded command: ${command.data.name}`);
          } else {
            logger.warn(`Command in ${file} is missing required 'data' property`);
          }
        } catch (error) {
          logger.error(`Error loading command ${file}:`, error);
        }
      }

      logger.info(`Successfully loaded ${this.commands.size} commands.`);
      return this.commands;
    } catch (error) {
      logger.error('Failed to load commands:', error);
      throw error;
    }
  }

  /**
   * Retrieves a command by name
   * @param {string} name - Command name
   * @returns {Command|undefined} Command instance or undefined if not found
   */
  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Retrieves all loaded commands
   * @returns {Collection<string, Command>} Collection of commands
   */
  getAllCommands(): Collection<string, Command> {
    return this.commands;
  }

  /**
   * Registers all commands with Discord's API
   * @async
   * @param {string} token - Discord bot token
   * @param {string} clientId - Discord client ID
   * @param {string} [guildId] - Optional guild ID for guild-specific commands
   * @returns {Promise<void>}
   * @throws {Error} If registration fails
   */
  async deployCommands(token: string, clientId: string, guildId?: string): Promise<void> {
    try {
      if (this.commands.size === 0) {
        await this.loadCommands();
      }

      const rest = new REST({ version: '10' }).setToken(token);
      const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());

      logger.debug('Started refreshing application (/) commands.');

      if (guildId) {
        // Guild-specific commands
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        logger.info(`Successfully reloaded ${commands.length} guild commands.`);
      } else {
        // Global commands
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: commands }
        );
        logger.info(`Successfully reloaded ${commands.length} global commands.`);
      }
    } catch (error) {
      logger.error('Failed to register commands:', error);
      throw error;
    }
  }
}