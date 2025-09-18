/**
 * @file MessageCreate.ts
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
export class MessageCreate extends Event {
    name = 'messageCreate'; // The Discord.js event name this handler is registered for
    once = false; // Whether the event should only be handled once (false for message events)
    messageProcessor; // The message processor that handles the actual message processing logic
    CATCHUP_AFTER_MESSAGES = 10; // After X messages, do a catchup
    CATCHUP_IF_MENTIONED_AFTER_MESSAGES = 5; // After X messages, if mentioned, do a catchup
    lastMessageCount = 0; // Tracks the number of messages since the last catchup
    ALLOWED_THREAD_IDS = ['1407811416244617388']; //TODO: hoist this to config
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
        // Check if the message is in a thread, and if so, if it's in an allowed thread
        if (this.disallowedThread(message)) {
            return;
        }
        // If we just posted a message, reset the counter, and ignore self
        if (message.author.id === message.client.user.id) {
            this.lastMessageCount = 0;
            logger.debug(`Reset message count: ${this.lastMessageCount}`);
            return;
        }
        // New message: Increment the counter
        this.lastMessageCount++;
        logger.debug(`Last message count: ${this.lastMessageCount}`);
        try {
            // Do not ignore if the message mentions the bot with @Daneel, or is a direct Discord reply
            if (this.isBotMentioned(message) || this.isReplyToBot(message)) {
                logger.debug(`Responding to mention in message ID: ${message.id}`);
                await this.messageProcessor.processMessage(message, true);
            }
            // If we are within the catchup threshold, catch up
            else if ((this.lastMessageCount >= this.CATCHUP_AFTER_MESSAGES) // if we are within the -regular- catchup threshold, catch up
                || (this.lastMessageCount >= this.CATCHUP_IF_MENTIONED_AFTER_MESSAGES && message.content.toLowerCase().includes(message.client.user.username.toLowerCase())) // if we were mentioned by name (plaintext), and are within the -mention- catchup threshold, catch up
            ) {
                logger.debug(`Catching up to message ID: ${message.id}`);
                this.lastMessageCount = 0;
                await this.messageProcessor.processMessage(message, false); // Do not direct-reply to anyone when catching up
            }
        }
        catch (error) {
            await this.handleError(error, message);
        }
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
     * Checks if A. the message is in a thread, and B. the thread is in a disallowed thread.
     * @private
     * @param {Message} message - The message to check
     * @returns {boolean} True if the message is in a disallowed thread, false otherwise
     */
    disallowedThread(message) {
        return message.channel.isThread() && !this.ALLOWED_THREAD_IDS.includes(message.channel.id);
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
//# sourceMappingURL=MessageCreate.js.map