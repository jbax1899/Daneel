/**
 * @file commandHandler.ts
 * @description Handles deployment and registration of slash commands with the Discord API.
 * Manages command discovery, validation, and registration.
 */
import { Collection } from 'discord.js';
import { Command } from '../commands/BaseCommand.js';
/**
 * Handles loading and managing Discord slash commands.
 * Responsible for discovering, validating, and registering commands with Discord's API.
 * @class CommandHandler
 */
export declare class CommandHandler {
    /** Collection of loaded commands, mapped by command name */
    private commands;
    /**
     * Loads all command files from the commands directory.
     * @async
     * @returns {Promise<Collection<string, Command>>}
     * @throws {Error} If there's an error loading commands
     */
    loadCommands(): Promise<Collection<string, Command>>;
    /**
     * Retrieves a command by name
     * @param {string} name - Command name
     * @returns {Command|undefined} Command instance or undefined if not found
     */
    getCommand(name: string): Command | undefined;
    /**
     * Retrieves all loaded commands
     * @returns {Collection<string, Command>} Collection of commands
     */
    getAllCommands(): Collection<string, Command>;
    /**
     * Registers all commands with Discord's API
     * @async
     * @param {string} token - Discord bot token
     * @param {string} clientId - Discord client ID
     * @param {string} [guildId] - Optional guild ID for guild-specific commands
     * @returns {Promise<void>}
     * @throws {Error} If registration fails
     */
    deployCommands(token: string, clientId: string, guildId?: string): Promise<void>;
}
