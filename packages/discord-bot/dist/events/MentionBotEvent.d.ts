import { Message } from 'discord.js';
import { Event } from './Event.js';
export declare class EventMentionBot extends Event {
    private openai;
    constructor(dependencies: {
        openai: any;
    });
    execute(message: Message): Promise<void>;
}
