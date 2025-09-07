import { OpenAIService, OpenAIMessage, OpenAIOptions } from '../openaiService.js';
import { ActivityOptions } from 'discord.js';
export interface Plan {
    action: 'message' | 'react' | 'ignore';
    modality: 'text' | 'tts';
    reaction?: string;
    openaiOptions: OpenAIOptions;
    presence?: {
        status?: 'online' | 'idle' | 'dnd' | 'invisible';
        activities?: ActivityOptions[];
        shardId?: number | null;
        afk?: boolean;
    };
}
export declare class Planner {
    private readonly openaiService;
    constructor(openaiService: OpenAIService);
    generatePlan(context?: OpenAIMessage[]): Promise<Plan>;
    private validatePlan;
}
