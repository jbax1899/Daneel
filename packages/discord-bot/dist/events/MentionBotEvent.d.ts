import { Message } from 'discord.js';
import { Event } from './Event.js';
interface Dependencies {
    openai: {
        apiKey: string;
    };
}
export declare class MentionBotEvent extends Event {
    readonly name: "messageCreate";
    readonly once = false;
    private readonly messageProcessor;
    constructor(dependencies: Dependencies);
    execute(message: Message): Promise<void>;
    private shouldIgnoreMessage;
    private isBotMentioned;
    private isReplyToBot;
    private handleError;
}
export {};
