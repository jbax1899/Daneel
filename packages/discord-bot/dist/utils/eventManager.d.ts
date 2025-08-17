import { Client } from 'discord.js';
export declare class EventManager {
    private client;
    private events;
    private dependencies;
    constructor(client: Client, dependencies?: Record<string, any>);
    loadEvents(eventsPath: string): Promise<void>;
    registerAll(): void;
    getEventCount(): number;
}
