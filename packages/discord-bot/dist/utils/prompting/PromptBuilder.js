/**
 * @file PromptBuilder.ts
 * @description Handles building conversation contexts for AI interactions in Discord.
 * Manages message history, system prompts, and context construction for AI model interactions.
 */
/**
 * Default system prompt used when no custom prompt is provided.
 * @constant
 * @type {string}
 */
const DEFAULT_SYSTEM_PROMPT = `
You are Daneel, modeled after R. Daneel Olivaw from Asimov’s Robot novels.
Be logical, ethical, and polite, speaking with precision and clarity in a formal yet approachable tone.`;
/**
 * Handles building conversation contexts for AI model interactions.
 * Manages message history, system prompts, and context construction.
 * @class PromptBuilder
 */
export class PromptBuilder {
    options;
    /**
     * Creates an instance of PromptBuilder.
     * @param {PromptBuilderOptions} [options={}] - Configuration options
     */
    constructor(options = {}) {
        this.options = {
            maxContextMessages: options.maxContextMessages || 10,
            systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        };
    }
    /**
     * Gets the current system prompt being used.
     * @returns {string} The current system prompt
     */
    getSystemPrompt() {
        return this.options.systemPrompt;
    }
    /**
     * Builds a conversation context from a Discord message.
     * @param {Message} message - The Discord message to build context from
     * @param {Record<string, any>} [additionalContext={}] - Optional additional context to include
     * @returns {Promise<MessageContext[]>} Array of message contexts for the AI model
     */
    async buildContext(message, additionalContext = {}) {
        let systemContent = this.getSystemPrompt(); // Create system message with both default prompt and additional context
        if (Object.keys(additionalContext).length > 0) {
            systemContent += '\nAdditional context for this interaction:\n' +
                Object.entries(additionalContext)
                    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
                    .join('\n');
        }
        const context = [
            {
                role: 'system',
                content: systemContent,
            },
        ];
        // Add message history
        const messages = await message.channel.messages.fetch({
            limit: this.options.maxContextMessages,
            before: message.id,
        });
        const messageHistory = Array.from(messages.values())
            .reverse()
            .filter(msg => msg.content.trim().length > 0)
            .map(msg => ({
            role: (msg.author.id === message.client.user?.id ? 'assistant' : 'user'),
            content: msg.content.replace(`<@${message.client.user?.id}>`, '').trim(),
        }));
        context.push(...messageHistory);
        // Add current message
        context.push({
            role: 'user',
            content: message.content.trim()
        });
        return context;
    }
}
//# sourceMappingURL=PromptBuilder.js.map