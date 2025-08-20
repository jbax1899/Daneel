import { logger } from '../logger.js';
const PLANNING_MODEL = 'gpt-5-mini';
const PLANNING_REASONING_EFFORT = 'medium';
const PLANNING_VERBOSITY = 'low';
const PLAN_SYSTEM_PROMPT = `You are a helpful AI assistant that helps manage and respond to Discord messages.
Analyze the conversation and determine the best response strategy.

Respond with only a JSON object, following the format below:
{
    "action": "reply", // What action should we take? Valid options: reply, dm, react, noop
    "modality": "text",
    "reaction": "", // If we're reacting to the message, what emoji should we use? Valid options: any emoji as a string
    "openaiOptions": {
        "reasoningEffort": "medium", // Controls the depth of reasoning (more reasoning = better quality but slower). Valid options: low, medium, high
        "verbosity": "low" // Controls the amount of detail in the response. Valid options: low, medium, high
    }
}
    
Do not include any additional text or explanation in your response. Only return the JSON object, filling out all fields, with valid options as specified.`;
const defaultPlan = {
    action: 'noop'
};
/**
 * Planner service that determines the best way to respond to messages
 */
export class Planner {
    openaiService;
    constructor(openaiService) {
        this.openaiService = openaiService;
    }
    /**
     * Generates a response plan based on the message and conversation context
     * @param message - The Discord message to respond to
     * @param context - Conversation context including previous messages
     * @returns A Promise that resolves to a GeneratePlan object
     */
    async generatePlan(message, context = []) {
        try {
            logger.debug('Generating plan...');
            // Prepare messages for the LLM
            const messages = [
                ...context,
                {
                    role: 'user',
                    content: message.content
                }
            ];
            const response = await this.openaiService.generateResponse([
                {
                    role: 'system',
                    content: PLAN_SYSTEM_PROMPT
                },
                ...messages.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                }))
            ], PLANNING_MODEL, {
                reasoningEffort: PLANNING_REASONING_EFFORT,
                verbosity: PLANNING_VERBOSITY
            });
            let plan = defaultPlan;
            try {
                // Parse and validate the response
                plan = JSON.parse(response.response || '{}');
                // Log plan
                logger.debug('Recieved plan:' + JSON.stringify(plan));
                logger.debug(`Tokens used: ${response.usage?.input_tokens} in | ${response.usage?.output_tokens} out | ${response.usage?.total_tokens} total | Cost: ${response.usage?.cost}`);
            }
            catch (error) {
                logger.error('Error parsing plan:', error);
                logger.warn('Returning default plan');
                return defaultPlan;
            }
            // Return the plan
            return {
                ...defaultPlan,
                action: plan.action,
                modality: plan.modality,
                reaction: plan.reaction,
                openaiOptions: plan.openaiOptions
            };
        }
        catch (error) {
            logger.error('Error in generatePlan:', error);
            return defaultPlan;
        }
    }
}
//# sourceMappingURL=Planner.js.map