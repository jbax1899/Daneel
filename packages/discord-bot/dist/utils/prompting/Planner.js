import { logger } from '../logger.js';
import { TTS_DEFAULT_OPTIONS } from '../openaiService.js';
const PLANNING_MODEL = 'gpt-5-mini';
const PLANNING_OPTIONS = { reasoningEffort: 'medium', verbosity: 'low' };
const PLAN_SYSTEM_PROMPT = `Only return a function call to "generate-plan"`;
const defaultPlan = {
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
                enum: ["message", "react", "ignore"],
                description: "The action to take. 'message' sends a message response (some combination of text and files), 'react' adds an emoji reaction(s) (use if a response could suffice as a string of emoji), 'ignore' does nothing (prefer 'react' over 'ignore')."
            },
            modality: {
                type: "string",
                enum: ["text", "tts"],
                description: "The modality to use. 'text' sends just a text response, 'tts' sends that text response with a TTS speech response. Prefer 'tts' for short/quick/causual responses or when asked to (and then set 'reasoningEffort' and 'verbosity' to 'low')."
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
                        enum: [/*"minimal", */ "low", "medium" /*, "high"*/],
                        description: "The level of reasoning to use, with 'low' being the default."
                    },
                    verbosity: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                        description: "The level of verbosity to use. Prefer 'low' for casual conversation, and 'medium' for more detailed responses. Only use 'high' when asked to be verbose/detailed."
                    },
                    tool_choice: {
                        type: "object",
                        properties: {
                            type: {
                                type: "string",
                                enum: ["none", "web_search"],
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
                            searchContextSize: { type: "string", enum: ["low", "medium" /*, "high"*/], description: "The size of the search context, 'medium' being the default." },
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
                            speed: { type: "string", enum: ["slow", "normal", "fast"], description: "Speed of speech." },
                            pitch: { type: "string", enum: ["low", "normal", "high"], description: "Pitch of speech." },
                            emphasis: { type: "string", enum: ["low", "normal", "high"], description: "Level of emphasis." },
                            style: { type: "string", enum: ["casual", "narrative", "cheerful", "sad", "angry"], description: "Speaking style." },
                            styleDegree: { type: "string", enum: ["low", "normal", "high"], description: "Weight of speaking style." }
                        },
                        required: ["speed", "pitch", "emphasis", "style", "styleDegree"]
                    }
                },
                required: ["reasoningEffort", "verbosity", "tool_choice"]
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
        required: ["action", "modality", "openaiOptions", "presence"]
    }
};
export class Planner {
    openaiService;
    constructor(openaiService) {
        this.openaiService = openaiService;
    }
    async generatePlan(context = []) {
        try {
            const messages = [...context];
            const openaiResponse = await this.openaiService.generateResponse(PLANNING_MODEL, [{ role: 'system', content: PLAN_SYSTEM_PROMPT }, ...messages], {
                ...PLANNING_OPTIONS,
                functions: [planFunction],
                function_call: { name: 'generate-plan' }
            });
            const response = {
                normalizedText: openaiResponse.message?.content,
                message: openaiResponse.message,
                finish_reason: openaiResponse.finish_reason,
                usage: openaiResponse.usage,
                newPresence: openaiResponse.newPresence
            };
            logger.debug(`Plan generated. Usage: ${JSON.stringify(response.usage)}`);
            const funcCall = response.message?.function_call;
            if (funcCall?.arguments) {
                try {
                    const parsed = JSON.parse(funcCall.arguments);
                    const validatedPlan = this.validatePlan(parsed);
                    logger.debug(`Validated plan: ${JSON.stringify(validatedPlan)}`);
                    return validatedPlan;
                }
                catch {
                    logger.warn('Failed to parse plan arguments, using default');
                    return defaultPlan;
                }
            }
            return defaultPlan;
        }
        catch (error) {
            logger.error('Planner.generatePlan error:', error);
            return defaultPlan;
        }
    }
    validatePlan(plan) {
        // Create a deep copy of defaultPlan to avoid mutating it
        const validatedPlan = JSON.parse(JSON.stringify(defaultPlan));
        // Merge the plan properties, ensuring nested objects are properly merged
        if (plan.openaiOptions) {
            validatedPlan.openaiOptions = {
                ...validatedPlan.openaiOptions,
                ...plan.openaiOptions,
                // Ensure ttsOptions is properly merged if it exists
                ...(plan.openaiOptions.ttsOptions ? {
                    ttsOptions: {
                        ...validatedPlan.openaiOptions.ttsOptions,
                        ...plan.openaiOptions.ttsOptions
                    }
                } : {})
            };
        }
        // Merge other top-level properties
        return {
            ...validatedPlan,
            ...plan,
            // Ensure we keep the merged openaiOptions
            openaiOptions: validatedPlan.openaiOptions
        };
    }
}
//# sourceMappingURL=Planner.js.map