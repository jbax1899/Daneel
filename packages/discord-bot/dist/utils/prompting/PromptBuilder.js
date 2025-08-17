/**
 * PromptBuilder - Handles building conversation contexts for AI interactions
 * Will contain logic to construct prompts based on message history and context
 */
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant in a Discord server.
You are named after R. Daneel Olivaw, a fictional robot created by Isaac Asimov.
Keep responses concise, friendly, and on-topic.`;
export class DiscordPromptBuilder {
    options;
    constructor(options = {}) {
        this.options = {
            maxContextMessages: options.maxContextMessages || 10,
            systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        };
    }
    async buildContext(message, additionalContext = {}) {
        const context = [
            {
                role: 'system',
                content: this.getSystemPrompt(),
            },
        ];
        // Add any additional context as system messages
        if (Object.keys(additionalContext).length > 0) {
            context.push({
                role: 'system',
                content: 'Additional context for this interaction:\n' +
                    Object.entries(additionalContext)
                        .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
                        .join('\n')
            });
        }
        // Add message history
        const messages = await message.channel.messages.fetch({
            limit: this.options.maxContextMessages,
            before: message.id,
        });
        const messageHistory = Array.from(messages.values())
            .reverse()
            .filter(msg => !msg.author.bot && msg.content.trim().length > 0)
            .map(msg => ({
            role: (msg.author.id === message.client.user?.id ? 'assistant' : 'user'),
            content: msg.content.replace(`<@${message.client.user?.id}>`, '').trim(),
            timestamp: msg.createdTimestamp,
        }));
        context.push(...messageHistory);
        // Add current message
        context.push({
            role: 'user',
            content: message.content.trim(),
            timestamp: message.createdTimestamp,
        });
        return context;
    }
    getSystemPrompt() {
        return this.options.systemPrompt;
    }
}
//# sourceMappingURL=PromptBuilder.js.map