import { OpenAIService, OpenAIMessage, OpenAIOptions } from '../openaiService.js';
import { ActivityOptions } from 'discord.js';
export interface Plan {
    action: 'message' | 'react' | 'ignore' | 'image';
    modality: 'text' | 'tts';
    reaction?: string;
    openaiOptions: OpenAIOptions;
    presence?: {
        status?: 'online' | 'idle' | 'dnd' | 'invisible';
        activities?: ActivityOptions[];
        shardId?: number | null;
        afk?: boolean;
    };
    imageRequest?: ImagePlanRequest;
}
type ImagePlanRequest = {
    prompt: string;
    aspectRatio?: 'auto' | 'square' | 'portrait' | 'landscape';
    background?: string;
    style?: string;
    allowPromptAdjustment?: boolean;
    followUpResponseId?: string;
};
export declare class Planner {
    private readonly openaiService;
    constructor(openaiService: OpenAIService);
    generatePlan(context?: OpenAIMessage[], trigger?: string): Promise<Plan>;
    private validatePlan;
    private normalizeImageRequest;
    private isValidAspectRatio;
}
export {};
