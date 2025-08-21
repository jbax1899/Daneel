import { OpenAIService, OpenAIMessage, OpenAIOptions } from '../openaiService.js';
export interface Plan {
    action: 'message' | 'react' | 'ignore';
    modality: 'text';
    reaction?: string;
    openaiOptions: OpenAIOptions;
}
export declare class Planner {
    private readonly openaiService;
    constructor(openaiService: OpenAIService);
    generatePlan(context?: OpenAIMessage[]): Promise<Plan>;
    private validatePlan;
}
