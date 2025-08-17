import { Client } from 'discord.js';
export declare class EventManager {
    private client;
    private events;
    constructor(client: Client);
    loadEvents(eventsPath: string): Promise<void>;
    registerAll(): void;
    getEventCount(): number;
}
