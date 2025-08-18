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
const DEFAULT_SYSTEM_PROMPT = `You are Daneel, modeled after R. Daneel Olivaw from Asimov’s Robot novels.
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
            defaultReasoningEffort: options.defaultReasoningEffort || 'medium',
            defaultVerbosity: options.defaultVerbosity || 'low',
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
     * Formats a message for the AI context
     * @private
     * @param {Message} msg - The message to format
     * @param {string} botUserId - The bot's user ID
     * @returns {{role: MessageRole, content: string}} Formatted message context
     */
    formatMessage(msg, botUserId) {
        const isBot = msg.author.id === botUserId;
        const isDeveloper = msg.author.id === process.env.DEVELOPER_USER_ID;
        const displayName = msg.member?.nickname || msg.author.username;
        const prefix = isBot ? '' : `(${msg.author.username}/${displayName}) - `;
        const content = `${prefix}${msg.content.replace(`<@${botUserId}>`, '').trim()}`;
        if (isBot)
            return { role: 'assistant', content };
        if (isDeveloper)
            return { role: 'developer', content };
        return { role: 'user', content };
    }
    /**
     * Builds a conversation context from a Discord message with GPT-5 specific options.
     * @param {Message} message - The Discord message to build context from
     * @param {Record<string, any>} [additionalContext={}] - Optional additional context to include
     * @param {BuildPromptOptions} [options] - GPT-5 specific options
     * @returns {Promise<{context: MessageContext[], options: BuildPromptOptions}>} The constructed message context and options
     */
    async buildContext(message, additionalContext = {}, options = {}) {
        // Apply defaults if not provided
        const mergedOptions = {
            reasoningEffort: this.options.defaultReasoningEffort,
            verbosity: this.options.defaultVerbosity,
            ...options
        };
        let systemContent = this.getSystemPrompt();
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
            .map(msg => this.formatMessage(msg, message.client.user.id));
        context.push(...messageHistory);
        // Add current message
        context.push({
            role: 'user',
            content: this.formatMessage(message, message.client.user.id).content
        });
        return {
            context,
            options: mergedOptions
        };
    }
}
//# sourceMappingURL=PromptBuilder.js.map