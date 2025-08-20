import type { Message as DiscordMessage } from 'discord.js';
import { OpenAIService, OpenAIMessage, OpenAIOptions } from '../openaiService';
/**
 * Represents the generated plan for how the bot should respond
 */
export interface Plan {
    action?: 'reply' | 'dm' | 'react' | 'noop';
    modality?: 'text';
    reaction?: string;
    openaiOptions?: OpenAIOptions;
}
/**
 * Planner service that determines the best way to respond to messages
 */
export declare class Planner {
    private readonly openaiService;
    constructor(openaiService: OpenAIService);
    /**
     * Generates a response plan based on the message and conversation context
     * @param message - The Discord message to respond to
     * @param context - Conversation context including previous messages
     * @returns A Promise that resolves to a GeneratePlan object
     */
    generatePlan(message: DiscordMessage, context?: OpenAIMessage[]): Promise<Plan>;
}
