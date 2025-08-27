import { logger } from '../logger.js';
import { OpenAIService, OpenAIMessage, OpenAIOptions, OpenAIResponse, SupportedModel } from '../openaiService.js';

const PLANNING_MODEL: SupportedModel = 'gpt-5-mini';
const PLANNING_OPTIONS: OpenAIOptions = { reasoningEffort: 'medium', verbosity: 'low' };

const PLAN_SYSTEM_PROMPT = `Only return a function call to "generate-plan"`;

export interface Plan {
  action: 'message' | 'react' | 'ignore';
  modality: 'text' | 'tts';
  reaction?: string;
  openaiOptions: OpenAIOptions;
}

const defaultPlan: Plan = {
  action: 'ignore',
  modality: 'text',
  reaction: '',
  openaiOptions: {
    reasoningEffort: 'low',
    verbosity: 'low'
  }
};

const planFunction = {
  name: "generate-plan",
  description: "Generates a structured plan for responding to a message",
  parameters: {
    type: "object",
    properties: {
      action: { 
        type: "string", 
        enum: ["message", "react", "ignore"],
      description: "The action to take. 'message' sends a message response (some combination of text and files), 'react' adds an emoji reaction(s) (use if a response could suffice as a string of emoji), 'ignore' does nothing (use when its best to ignore the message)"
      },
      modality: { 
        type: "string",
        enum: ["text", "tts"],
        description: "The modality to use. 'text' sends a text response, 'tts' sends a speech response in addition to the text response. Use 'tts' for casual conversation where 'reasoningEffort' and 'verbosity' are 'minimal' or 'low', or when asked to (but then set 'reasoningEffort' and 'verbosity' to 'low')."
      },
      reaction: { 
        type: "string",
        description: "A string containing only emoji characters (no text). Required when action is 'react'. Example: 🤖👍",
      },
      openaiOptions: {
        type: "object",
        properties: {
          reasoningEffort: { 
            type: "string", 
            enum: ["minimal", "low", "medium", "high"],
            description: "The level of reasoning to use. Prefer 'low', then 'medium', then 'high'. Only use 'minimal' if asked to think fast etc."
          },
          verbosity: { 
            type: "string", 
            enum: ["low","medium","high"],
            description: "The level of verbosity to use. Prefer 'low', then 'medium'. Only use 'high' when asked to be verbose etc."
          }
        },
        required: ["reasoningEffort","verbosity"]
      }
    },
    required: ["action","modality","openaiOptions"]
  }
};

export class Planner {
  constructor(private readonly openaiService: OpenAIService) {}

  public async generatePlan(context: OpenAIMessage[] = []): Promise<Plan> {
    try {
      const messages: OpenAIMessage[] = [...context];

      const openaiResponse = await this.openaiService.generateResponse(
        PLANNING_MODEL,
        [{ role: 'system', content: PLAN_SYSTEM_PROMPT }, ...messages],
        { 
          ...PLANNING_OPTIONS, 
          functions: [planFunction], 
          function_call: { name: 'generate-plan' }
        }
      );
      //logger.debug(`Raw OpenAI response: ${JSON.stringify(openaiResponse)}`);

      const response: OpenAIResponse = {
        normalizedText: openaiResponse.message?.content || "Error: No plan generated",
        message: openaiResponse.message,
        finish_reason: openaiResponse.finish_reason,
        usage: openaiResponse.usage
      }
      logger.debug(`Plan generated. Usage: ${JSON.stringify(response.usage)}`);

      const funcCall = response.message?.function_call;
      if (funcCall?.arguments) {
        try {
          const parsed = JSON.parse(funcCall.arguments) as Partial<Plan>;
          return this.validatePlan(parsed);
        } catch {
          logger.warn('Failed to parse plan arguments, using default');
          return defaultPlan;
        }
      }

      return defaultPlan;
    } catch (error) {
      logger.error('Planner.generatePlan error:', error);
      return defaultPlan;
    }
  }

  private validatePlan(plan: Partial<Plan>): Plan {
    const validated: Plan = { ...defaultPlan, ...plan };

    validated.action = ['message','react','ignore'].includes(validated.action) ? validated.action : defaultPlan.action;
    validated.modality = validated.modality ?? defaultPlan.modality;
    validated.reaction = validated.reaction ?? defaultPlan.reaction;
    validated.openaiOptions = validated.openaiOptions ?? defaultPlan.openaiOptions;

    logger.debug(`Plan validated: ${JSON.stringify(validated)}`);

    return validated;
  }
}
