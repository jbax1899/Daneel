/**
 * @file eventManager.ts
 * @description Manages loading and handling Discord.js events.
 * Handles dynamic loading of event handlers and binding them to Discord client events.
 */
import { Client } from 'discord.js';
/**
 * Manages Discord.js events for the bot.
 * Handles dynamic loading of event handlers and binding them to Discord client events.
 * @class EventManager
 */
export declare class EventManager {
    private client;
    /** Collection of loaded event handlers */
    private events;
    /** Dependencies to be injected into event handlers */
    private dependencies;
    /**
     * Creates an instance of EventManager.
     * @param {Client} client - The Discord.js client instance
     * @param {Record<string, any>} [dependencies={}] - Dependencies to inject into event handlers
     */
    constructor(client: Client, dependencies?: Record<string, any>);
    /**
     * Loads event handlers from the specified directory.
     * @async
     * @param {string} eventsPath - Path to the directory containing event handlers
     * @returns {Promise<void>}
     * @throws {Error} If there's an error loading events
     */
    loadEvents(eventsPath: string): Promise<void>;
    /**
     * Registers all loaded events with the Discord client.
     * @returns {void}
     */
    registerAll(): void;
    /**
     * Gets the number of loaded events.
     * @returns {number} Number of loaded events
     */
    getEventCount(): number;
}
