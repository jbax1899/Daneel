/**
 * Base event class for Discord.js events with error handling and registration
 */
import { Client, ClientEvents } from 'discord.js';
/** Structure of an event handler */
export interface IEvent {
    name: keyof ClientEvents;
    once?: boolean;
    execute: (...args: any[]) => Promise<void> | void;
}
/** Base class for Discord.js event handlers */
export declare abstract class Event implements IEvent {
    name: keyof ClientEvents;
    once: boolean;
    constructor(options: {
        name: keyof ClientEvents;
        once?: boolean;
    });
    /** Main execution method to be implemented by subclasses */
    abstract execute(...args: any[]): Promise<void> | void;
    /** Register this event with a Discord client */
    register(client: Client): void;
    private _execute;
}
