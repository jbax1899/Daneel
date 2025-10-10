import { logger } from '../logger.js';
import { OpenAIService, OpenAIMessage, OpenAIOptions, OpenAIResponse, SupportedModel, TTS_DEFAULT_OPTIONS } from '../openaiService.js';
import { ActivityOptions } from 'discord.js';

const PLANNING_MODEL: SupportedModel = 'gpt-5-mini';
const PLANNING_OPTIONS: OpenAIOptions = { reasoningEffort: 'medium', /*verbosity: 'low'*/ }; // TODO: trying out high reasoning effort, and letting it handle verbosity
const PLAN_SYSTEM_PROMPT = `You are a planning LLM that generates structured responses for the "generate-plan" function.
Do not omit any required field.
Only return a function call to "generate-plan", formatted according to its JSON schema.
Always follow the example pattern: populate 'repoQuery' with relevant keywords, separated by commas.
If you see <summarized> before a message, it means that message has been summarized by the reduction LLM, and is not the original message, though the role is still the same.
Prefer the 'message' action whenever the user is chatting, asking questions, or making indirect references. Only pick 'image' when the user explicitly requests an image/variation, directly asks you to create or refine visuals, or it is unmistakably the best response (e.g., "please draw", "make an image", "edit that picture").
When selecting the 'image' action, default imageRequest.allowPromptAdjustment to false unless the user clearly asks for improvements or rewording.
When the triggering message directly replies to one of Daneel's earlier messages, treat that replied-to content as the primary target—especially for image variations. Use its identifiers and details if you reference an existing image.
When you choose 'image', you must populate imageRequest.prompt and may set optional fields to guide the generation.`;

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
  }
  imageRequest?: ImagePlanRequest;
  //repoQuery?: string;
}

type ImagePlanRequest = {
  prompt: string;
  aspectRatio?: 'auto' | 'square' | 'portrait' | 'landscape';
  background?: string;
  style?: string;
  allowPromptAdjustment?: boolean;
  followUpResponseId?: string;
};

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
    },
    ttsOptions: TTS_DEFAULT_OPTIONS
  }
};

const planFunction = {
  name: "generate-plan",
  description: "Generates a structured plan for responding to a message.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["message", "react", "ignore", "image"],
      description: "The action to take: 'message' sends a message response (some combination of text and files), 'react' uses Discord's react feature to react to the last message with one or more emoji, 'ignore' does nothing, and 'image' generates an image using the dedicated pipeline (and posts a summary plus buttons). Based on the last message (which triggered this to run) and the context of the conversation (especially the most recent messages by timestamp), you should decide which of these actions to take. Depending on how you were triggered, a response may not be neccessary (such as a catchup event, which simply ran because N number of messages were sent from other users since your last response). If unsure, prefer to 'react'."
      },
      modality: { 
        type: "string",
        enum: ["text", "tts"],
        description: "The modality to use: 'text' sends just a text response, 'tts' sends that text response along with a TTS reading. Prefer 'tts' for short/causal responses, or when asked to (and then set 'reasoningEffort' and 'verbosity' to 'low'), and 'text' for longer/more complex responses."
      },
      reaction: {
        type: "string",
        description: "A string containing only emoji characters (no text). Required when action is 'react'. Example: 🤖👍",
      },
      imageRequest: {
        type: "object",
        description: "Details for image generation when action is 'image'.",
        properties: {
          prompt: { type: "string", description: "Detailed description of the image to generate." },
          aspect_ratio: {
            type: "string",
            enum: ["auto", "square", "portrait", "landscape"],
            description: "Preferred aspect ratio for the generated image."
          },
          background: {
            type: "string",
            enum: ["auto", "transparent", "opaque"],
            description: "Background mode for the generated image."
          },
          style: {
            type: "string",
            description: "Optional style preset (e.g., natural, photorealistic, watercolor)."
          },
          allowPromptAdjustment: {
            type: "boolean",
            description: "Whether the model may adjust the prompt before rendering. Leave false unless the user explicitly asks for prompt improvements."
          },
          followUpResponseId: {
            type: "string",
            description: "Existing response ID when requesting a variation."
          }
        },
        required: ["prompt"]
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
            enum: ["low","medium"/*,"high"*/],
            description: "The level of verbosity to use. Prefer 'low' for casual conversation, and 'medium' for more detailed responses."// Only use 'high' when asked to be verbose/detailed."
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
          },
          ttsOptions: {
            type: "object",
            description: "Controls how the TTS response should be generated. Required if 'modality' is 'tts'.",
            properties: {
              //model:      { type: "string", description: "The model to use for TTS." }, // hardcoded to "gpt-4o-mini-tts" for now
              //voice:      { type: "string", description: "The voice to use for TTS." }, // hardcoded to "echo" for now
              speed:        { type: "string", enum: ["slow", "normal", "fast"], description: "Speed of speech." },
              pitch:        { type: "string", enum: ["low", "normal", "high"], description: "Pitch of speech." },
              emphasis:     { type: "string", enum: ["low", "normal", "high"], description: "Level of emphasis." },
              style:        { type: "string", enum: ["casual", "narrative", "cheerful", "sad", "angry"], description: "Speaking style." },
              styleDegree:  { type: "string", enum: ["low", "normal", "high"], description: "Weight of speaking style." },
              styleNote:    { type: "string", description: "Additional notes about the speaking style." }
            },
            required: ["speed", "pitch", "emphasis", "style", "styleDegree"]
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
          //shardId: { type: "number", description: "Shard ID to apply this presence to" }
        },
        required: ["status"]
      }
    },
    // Disabled for now - It keeps adding WAY too much context, but is rarely needed/useful
    /*
    repoQuery: {
      type: "string",
      description: "Retrieves information about this repository (Daneel's open-source code base). Do this when asked about the codebase, on request, or if it may be relevant to the conversation. Return a string with up to THREE queries to perform, separated by commas.",
      default: ""
    },
    */
    required: ["action","modality","openaiOptions","presence"]
  }
};

export class Planner {
  constructor(private readonly openaiService: OpenAIService) {}

  public async generatePlan(context: OpenAIMessage[] = [], trigger: string = ''): Promise<Plan> {
    try {
      const messages: OpenAIMessage[] = [...context];

      const openaiResponse = await this.openaiService.generateResponse(
        PLANNING_MODEL,
        [
          { role: 'system', content: PLAN_SYSTEM_PROMPT },
          { role: 'system', content: `This planner was triggered because ${trigger}.` }, // The planner should know how it was triggered: Either a Discord direct reply/ping, or it decided to reply itself (e.g. a catchup event)
          ...messages
        ],
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
          const validatedPlan = this.validatePlan(parsed);
          logger.debug(`Validated plan: ${JSON.stringify(validatedPlan)}`);
          return validatedPlan;
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
    //logger.debug(`Validating plan: ${JSON.stringify(plan)}`);
    //logger.debug(`Default plan: ${JSON.stringify(defaultPlan)}`);
  
    // Deep copy of defaultPlan
    const validatedPlan: Plan = JSON.parse(JSON.stringify(defaultPlan));
  
    // Merge openaiOptions (with nested ttsOptions)
    if (plan.openaiOptions) {
      validatedPlan.openaiOptions = {
        ...validatedPlan.openaiOptions,
        ...plan.openaiOptions,
        ...(plan.openaiOptions.ttsOptions ? {
          ttsOptions: {
            ...validatedPlan.openaiOptions.ttsOptions,
            ...plan.openaiOptions.ttsOptions
          }
        } : {})
      };
    }
  
    // Merge other top-level properties
    const mergedPlan: Plan = {
      ...validatedPlan,
      ...plan,
      openaiOptions: validatedPlan.openaiOptions,
      //repoQuery: (plan.repoQuery ?? validatedPlan.repoQuery ?? '') as string
    };

    if (plan.imageRequest) {
      mergedPlan.imageRequest = this.normalizeImageRequest(plan.imageRequest);
    }

    return mergedPlan;
  }

  private normalizeImageRequest(request: Partial<ImagePlanRequest>): ImagePlanRequest {
    const aspectRatio = this.isValidAspectRatio(request.aspectRatio) ? request.aspectRatio : 'auto';
    const background = typeof request.background === 'string' ? request.background : 'auto';
    const style = typeof request.style === 'string' ? request.style : 'unspecified';
    const followUpResponseId = typeof request.followUpResponseId === 'string' && request.followUpResponseId.trim()
      ? request.followUpResponseId.trim()
      : undefined;

    return {
      prompt: (request.prompt ?? '').toString(),
      aspectRatio,
      background,
      style,
      // Automated image requests should only opt into prompt adjustments when the
      // planner is absolutely certain the user requested it. Leaving this false by
      // default keeps follow-up embeds compact and faithful to the user's wording.
      allowPromptAdjustment: request.allowPromptAdjustment !== undefined
        ? Boolean(request.allowPromptAdjustment)
        : false,
      followUpResponseId
    };
  }

  private isValidAspectRatio(value: unknown): value is ImagePlanRequest['aspectRatio'] {
    return value === 'auto' || value === 'square' || value === 'portrait' || value === 'landscape';
  }
}
