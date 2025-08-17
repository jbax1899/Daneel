/**
 * Command Handler
 * 
 * Handles deployment and registration of slash commands with the Discord API.
 * Manages command discovery, validation, and registration.
 */

import { REST, Routes, Collection } from 'discord.js';
import { Command } from '../commands/BaseCommand.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { readdir } from 'fs/promises';
import { logger } from './logger.js';

const commandsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../commands');

export class CommandHandler {
  private commands = new Collection<string, Command>();

  async loadCommands() {
    try {
      logger.debug('Loading commands...');

      // In development, we need to look in the src directory for .ts files
      const isDev = process.env.NODE_ENV !== 'production';
      const basePath = isDev ? path.join(process.cwd(), 'src/commands') : commandsPath;
      
      const commandFiles = (await readdir(basePath))
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
          logger.error(`Error loading command from ${file}:`, error);
        }
      }

      logger.info(`Successfully loaded ${this.commands.size} commands.`);
      return this.commands;
    } catch (error) {
      logger.error('Failed to load commands:', error);
      throw error;
    }
  }

  async deployCommands(token: string, clientId: string, guildId: string) {
    try {
      if (this.commands.size === 0) {
        await this.loadCommands();
      }

      const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
      const rest = new REST({ version: '10' }).setToken(token);
      
      logger.debug('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );

      logger.info(`Successfully deployed ${commands.length} application (/) commands.`);
      return commands;
    } catch (error) {
      logger.error('Error deploying commands:', error);
      throw error;
    }
  }

  getCommand(name: string) {
    return this.commands.get(name);
  }

  getAllCommands() {
    return this.commands;
  }
}