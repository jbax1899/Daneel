/**
 * @file MentionBotEvent.ts
 * @description Handles the 'messageCreate' event from Discord.js, specifically for processing
 * messages that mention the bot or are replies to the bot.
 */
import { Event } from './Event.js';
import { logger } from '../utils/logger.js';
import { MessageProcessor } from '../utils/MessageProcessor.js';
import { Planner } from '../utils/prompting/Planner.js';
/**
 * Handles messages that mention the bot or are replies to the bot.
 * Extends the base Event class to process messages and generate responses.
 * @class MentionBotEvent
 * @extends {Event}
 */
export class MentionBotEvent extends Event {
    /** The Discord.js event name this handler is registered for */
    name = 'messageCreate';
    /** Whether the event should only be handled once (false for message events) */
    once = false;
    /** The message processor that handles the actual message processing logic */
    messageProcessor;
    /**
     * Creates an instance of MentionBotEvent
     * @param {Dependencies} dependencies - Required dependencies including OpenAI configuration
     */
    constructor(dependencies) {
        super({ name: 'messageCreate', once: false });
        this.messageProcessor = new MessageProcessor({
            openaiService: dependencies.openaiService,
            planner: new Planner(dependencies.openaiService)
        });
    }
    /**
     * Main execution method called when a message is created.
     * Processes the message if it's not ignored.
     * @param {Message} message - The Discord message that was created
     * @returns {Promise<void>}
     */
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
    /**
     * Determines if a message should be ignored based on certain criteria.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the message should be ignored, false otherwise
     */
    shouldIgnoreMessage(message) {
        // Ignore messages from self
        if (message.author.id === message.client.user.id)
            return true;
        // Do not ignore if the message mentions the bot with @Daneel, or is a direct Discord reply
        if (this.isBotMentioned(message) || this.isReplyToBot(message)) {
            return false;
        }
        return true;
    }
    /**
     * Checks if the bot is mentioned in the message.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the bot is mentioned, false otherwise
     */
    isBotMentioned(message) {
        return message.mentions.users.has(message.client.user.id); // Discord converts @Daneel to the bot's ID
    }
    /**
     * Checks if the message is a reply to the bot.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the message is a reply to the bot, false otherwise
     */
    isReplyToBot(message) {
        if (!message.reference?.messageId)
            return false;
        const isSameChannel = message.reference.guildId === message.guildId &&
            message.reference.channelId === message.channelId;
        const isReplyingToBot = message.mentions.repliedUser?.id === message.client.user.id;
        return isSameChannel && isReplyingToBot;
    }
    /**
     * Handles errors that occur during message processing.
     * Logs the error and attempts to notify the user.
     * @private
     * @param {unknown} error - The error that occurred
     * @param {Message} message - The message that was being processed when the error occurred
     * @returns {Promise<void>}
     */
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