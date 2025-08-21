/**
 * @file Event.ts
 * @description Base event class for Discord.js events with robust error handling and registration.
 * This provides a foundation for all Discord.js event handlers in the application.
 */
import { Client, ClientEvents } from 'discord.js';
/**
 * Abstract base class for Discord.js event handlers.
 * Provides consistent error handling and event registration.
 * @abstract
 * @class Event
 */
export declare abstract class Event {
    /** The name of the Discord.js event to listen for */
    readonly name: keyof ClientEvents;
    /** Whether the event should only be handled once */
    readonly once: boolean;
    /**
     * Creates an instance of Event.
     * @param {Object} options - Configuration options for the event
     * @param {keyof ClientEvents} options.name - The name of the Discord.js event
     * @param {boolean} [options.once=false] - If true, the event will only be handled once
     */
    constructor(options: {
        name: keyof ClientEvents;
        once?: boolean;
    });
    /**
     * Main execution method to be implemented by subclasses.
     * This method contains the logic to execute when the event is emitted.
     * @abstract
     * @param {...any[]} args - Arguments passed by the Discord.js client
     * @returns {Promise<void> | void}
     */
    abstract execute(...args: any[]): Promise<void> | void;
    /**
     * Registers the event with the Discord.js client.
     * @param {Client} client - The Discord.js client instance
     */
    register(client: Client): void;
    /**
     * Wraps the execute method with error handling.
     * @private
     * @param {...any[]} args - Arguments passed by the Discord.js client
     */
    private _execute;
}
