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
    verbosity: 'low',
    tool_choice: 'auto',
    webSearch: {
      query: '',
      allowedDomains: [],
      searchContextSize: 'low',
      userLocation: { type: 'approximate' }
    }
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
      description: "The action to take. 'message' sends a message response (some combination of text and files), 'react' adds an emoji reaction(s) (use if a response could suffice as a string of emoji), 'ignore' does nothing (though typically you should prefer 'react' over 'ignore')."
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
            enum: [/*"minimal", */"low", "medium"/*, "high"*/],
            description: "The level of reasoning to use, with 'low' being the default."
          },
          verbosity: { 
            type: "string", 
            enum: ["low","medium","high"],
            description: "The level of verbosity to use. Prefer 'low' for casual conversation, and 'medium' for more detailed responses. Only use 'high' when asked to be verbose/detailed."
          },
          tool_choice: {
            type: "object",
            properties: {
              type: { 
                type: "string", 
                enum: ["none","web_search"],
                description: "'none' performs no tool calls. 'web_search' performs a web search for a given query and should be used to find information that the assistant needs to respond to the message (real-time information especially). Always pair this with reasoningEffort >= low."
              }
            },
            required: ["type"]
          },
          webSearch: {
            type: "object",
            properties: {
              query: { type: "string", description: "If performing a web_search, the query to perform a web search for." },
              //allowedDomains: { type: "array", items: { type: "string" }, description: "An array of allowed domains to search within." },
              searchContextSize: { type: "string", enum: ["low", "medium"/*, "high"*/], description: "The size of the search context, 'medium' being the default." },
              /*
              userLocation: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["approximate", "exact"], description: "The type of user location." },
                  country: { type: "string", description: "The ISO country code." },
                  city: { type: "string", description: "The city." },
                  region: { type: "string", description: "The region." },
                  timezone: { type: "string", description: "The IANA timezone." }
                },
                required: ["type"]
              }
              */
            },
            required: ["query", "searchContextSize"]
          }
        },
        required: ["reasoningEffort","verbosity","tool_choice"]
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
      )

      const response: OpenAIResponse = {
        normalizedText: openaiResponse.message?.content,
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
