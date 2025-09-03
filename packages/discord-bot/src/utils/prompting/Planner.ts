import { logger } from '../logger.js';
import { OpenAIService, OpenAIMessage, OpenAIOptions, OpenAIResponse, SupportedModel } from '../openaiService.js';
import { ActivityOptions } from 'discord.js';

const PLANNING_MODEL: SupportedModel = 'gpt-5-mini';
const PLANNING_OPTIONS: OpenAIOptions = { reasoningEffort: 'medium', verbosity: 'low' };

const PLAN_SYSTEM_PROMPT = `Only return a function call to "generate-plan"`;

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
  }
}

const defaultPlan: Plan = {
  action: 'ignore',
  modality: 'text',
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
              /*userLocation: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["approximate", "exact"], description: "The type of user location." },
                  country: { type: "string", description: "The ISO country code." },
                  city: { type: "string", description: "The city." },
                  region: { type: "string", description: "The region." },
                  timezone: { type: "string", description: "The IANA timezone." }
                },
                required: ["type"]
              }*/
            },
            required: ["query", "searchContextSize"]
          }
        },
        required: ["reasoningEffort","verbosity","tool_choice"]
      },
      presence: {
        type: "object",
        description: "The new presence to set for the Discord bot",
        properties: {
          status: {
            type: "string",
            enum: ["online", "idle", "dnd", "invisible"],
            description: "The bot's overall status."
          },
          activities: {
            type: "array",
            description: "List of activities for the bot to display.",
            items: {
              type: "object",
              properties: {
                type: { 
                  type: "integer",
                  enum: [0, 1, 2, 3, 4, 5],
                  description: "Activity type: 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching, 4 = Custom (prefer this), 5 = Competing."
                },
                name: { type: "string", description: "The activity alone (e.g., chess) to be used with prefixed activity types (e.g., Playing chess, but without the 'Playing ' prefix). 24 characters max." },
                state: { type: "string", description: "The full activity string (e.g., Playing chess with Jordan). 30 characters max." },
                url: { type: "string", description: "Streaming URL (required if type = 1)" },
              },
              required: ["type", "name", "state"]
            }
          },
          afk: { type: "boolean", description: "Whether the bot is AFK" },
          shardId: { type: "number", description: "Shard ID to apply this presence to" }
        },
        required: ["status"]
      }
    },
    required: ["action","modality","openaiOptions","presence"]
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
        usage: openaiResponse.usage,
        newPresence: openaiResponse.newPresence
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
    const validatedPlan: Plan = { ...defaultPlan, ...plan };

    // Check that input matches what is expected (and if not, use default)
    // TODO: Validate better
    validatedPlan.action        = plan.action ? plan.action : defaultPlan.action;
    validatedPlan.modality      = plan.modality ? plan.modality : defaultPlan.modality;
    validatedPlan.reaction      = plan.reaction ? plan.reaction : defaultPlan.reaction;
    validatedPlan.openaiOptions = plan.openaiOptions ? plan.openaiOptions : defaultPlan.openaiOptions;
    validatedPlan.presence   = plan.presence ? plan.presence : defaultPlan.presence;

    logger.debug(`Plan validated: ${JSON.stringify(validatedPlan)}`);

    return validatedPlan;
  }
}
