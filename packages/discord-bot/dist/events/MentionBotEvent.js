import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { OpenAIService } from '../utils/openaiService.js';
import { DiscordPromptBuilder } from '../utils/prompting/PromptBuilder.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';
export class MentionBotEvent extends Event {
    name = 'messageCreate'; // The event name from discord.js that we are listening to
    once = false;
    messageProcessor;
    constructor(dependencies) {
        super({ name: 'messageCreate', once: false });
        this.messageProcessor = new MessageProcessor({
            promptBuilder: new DiscordPromptBuilder(),
            openaiService: new OpenAIService(dependencies.openai.apiKey)
        });
    }
    async execute(message) {
        if (this.shouldIgnoreMessage(message))
            return;
        try {
            await this.messageProcessor.processMessage(message);
        }
        catch (error) {
            await this.handleError(error, message);
        }
    }
    shouldIgnoreMessage(message) {
        // Logic for ignoring messages
        // 1. Ignore messages from other bots
        // 2. Ignore messages that don't either mention the bot or reply to the bot
        if (message.author.bot)
            return true;
        return !this.isBotMentioned(message) && !this.isReplyToBot(message);
    }
    isBotMentioned(message) {
        return message.mentions.users.has(message.client.user.id);
    }
    isReplyToBot(message) {
        if (!message.reference?.messageId)
            return false;
        const isSameChannel = message.reference.guildId === message.guildId &&
            message.reference.channelId === message.channelId;
        const isReplyingToBot = message.mentions.repliedUser?.id === message.client.user.id;
        return isSameChannel && isReplyingToBot;
    }
    async handleError(error, message) {
        logger.error('Error in MentionBotEvent:', error);
        // Attempt to send an error reply to the user
        try {
            const response = 'Sorry, I encountered an error while processing your message.';
            if (message.channel.isTextBased()) {
                await message.reply(response);
            }
        }
        catch (replyError) {
            logger.error('Failed to send error reply:', replyError);
        }
    }
}
//# sourceMappingURL=MentionBotEvent.js.map