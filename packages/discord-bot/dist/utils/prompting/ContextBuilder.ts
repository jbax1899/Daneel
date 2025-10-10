import { Message } from 'discord.js';
import { OpenAIMessage, OpenAIService } from '../openaiService.js';
import { logger } from '../logger.js';
import { renderPrompt } from '../env.js';

const VERBOSE_CONTEXT_ENV_FLAG = 'DISCORD_BOT_LOG_FULL_CONTEXT';

export const isFullContextLoggingEnabled = (): boolean =>
    (process.env[VERBOSE_CONTEXT_ENV_FLAG] || '').toLowerCase() === 'true';

export const logContextIfVerbose = (context: OpenAIMessage[]): void => {
    if (!isFullContextLoggingEnabled()) {
        return;
    }

    logger.debug(`Full context: ${JSON.stringify(context)}`);
};

export class ContextBuilder {
    private readonly openaiService: OpenAIService;
    private readonly DEFAULT_CONTEXT_MESSAGES = 12;

    constructor(openaiService: OpenAIService) {
        this.openaiService = openaiService;
    }

    /**
     * Builds the message context for the given message
     * @param {Message} message - The message to build the context for
     * @returns {Promise<{ context: OpenAIMessage[] }>} The message context
     */
    public async buildMessageContext(message: Message, maxMessages: number = this.DEFAULT_CONTEXT_MESSAGES): Promise<{ context: OpenAIMessage[] }> {
        logger.debug(`Building message context for message ID: ${message.id} (${message.content?.substring(0, 50)}${message.content?.length > 50 ? '...' : ''})`);

        // Get the message being replied to if this is a reply
        const repliedMessage = message.reference?.messageId
            ? await message.channel.messages.fetch(message.reference.messageId).catch((error) => {
                logger.debug(`Failed to fetch replied message ${message.reference?.messageId}: ${error.message}`);
                return null;
            })
            : null;

        logger.debug(`Is reply: ${!!repliedMessage}${repliedMessage ? ` (to message ID: ${repliedMessage.id})` : ''}`);

        // Fetch messages before the current message
        const recentMessages = await message.channel.messages.fetch({
            limit: repliedMessage ? Math.floor(maxMessages / 2) : maxMessages, // Use half the messages if this is a reply, as we'll fetch more messages before the replied-to message
            before: message.id
        });
        logger.debug(`Fetched ${recentMessages.size} recent messages before current message`);

        // If this is a reply, fetch messages before the replied message as well
        let contextMessages = new Map(recentMessages);
        if (repliedMessage) {
            const messagesBeforeReply = await message.channel.messages.fetch({
                limit: maxMessages,
                before: repliedMessage.id
            });
            logger.debug(`Fetched ${messagesBeforeReply.size} messages before replied message`);

            // Merge both message collections, removing duplicates
            const beforeMergeSize = contextMessages.size;
            messagesBeforeReply.forEach((msg, id) => {
                if (!contextMessages.has(id)) {
                    contextMessages.set(id, msg);
                }
            });
            logger.debug(`Added ${contextMessages.size - beforeMergeSize} new messages from before replied message`);

            // Add the replied message if it's not already included
            if (!contextMessages.has(repliedMessage.id)) {
                contextMessages.set(repliedMessage.id, repliedMessage);
                logger.debug(`Added replied message to context: ${repliedMessage.id}`);
            }
        }

        // Build the message history
        let messageIndex = 0;
        let repliedMessageIndex = null;
        const history: OpenAIMessage[] = Array.from(contextMessages.values())
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
            .map(m => {
                const isBot = m.author.id === message.client.user?.id;
                const displayName = m.member?.displayName || m.author.username;
                const timestamp = new Date(m.createdTimestamp).toISOString()
                    .replace(/T/, ' ')
                    .replace(/\..+/, '')
                    .slice(0, -3); // Trim to minutes
                let formattedMessage = `[${messageIndex++}] At ${timestamp} ${m.author.username}${displayName !== m.author.username ? `/${displayName}` : ''}${isBot ? ' (bot)' : ''} said: "${m.content}"`;

                // If this is the replied message, set the replied message index
                if (repliedMessage && m.id === repliedMessage.id) {
                    repliedMessageIndex = messageIndex;
                }

                // Include embeds with full context (as in EmbedBuilder.ts)
                let embedIndex = 1;
                if (m.embeds.length > 0) {
                    formattedMessage += '\nEmbeds: ';
                    m.embeds.forEach(embed => {
                        if (embed.title) formattedMessage += `\n${embedIndex++}. Title: ${embed.title}`;
                        if (embed.description) formattedMessage += `\nDescription: ${embed.description}`;
                        if (embed.footer) formattedMessage += `\nFooter: ${embed.footer.text}`;
                        if (embed.image) formattedMessage += `\nImage: ${embed.image.url}`;
                        if (embed.thumbnail) formattedMessage += `\nThumbnail: ${embed.thumbnail.url}`;
                        if (embed.author) formattedMessage += `\nAuthor: ${embed.author.name}`;
                        if (embed.provider) formattedMessage += `\nProvider: ${embed.provider.name}`;
                        if (embed.url) formattedMessage += `\nURL: ${embed.url}`;
                        embedIndex++;
                    });
                }

                return {
                    role: isBot ? 'assistant' : 'user' as const,
                    content: isBot ? m.content : formattedMessage
                };
            });

        // Reduce the context by summarizing large messages
        // Note that this does not include the message being replied to (it is added later), because we should always have full context of that message
        let reducedHistory = await this.openaiService.reduceContext(history);

        // Add the current message
        reducedHistory.push({
            role: 'user',
            content: `${message.member?.displayName || message.author.username} said: "${message.content}" ${repliedMessageIndex ? ` (Replying to message ${repliedMessageIndex - 1})` : ''}`
        });

        // Build the final context
        const systemPrompt = renderPrompt('discord.chat.system').content;
        const context: OpenAIMessage[] = [
            { role: 'system', content: systemPrompt },
            ...reducedHistory
        ];
        logContextIfVerbose(context);

        logger.debug(`Final context built with ${context.length} messages (${reducedHistory.length} history + 1 system)`);
        return { context };
    }
}