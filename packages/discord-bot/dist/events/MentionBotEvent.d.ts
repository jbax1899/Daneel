import { Message } from 'discord.js';
import { Event } from './Event.js';
import OpenAI from 'openai';
export declare class EventMentionBot extends Event {
    private openai;
    constructor(openai: OpenAI);
    execute(message: Message): Promise<void>;
}
