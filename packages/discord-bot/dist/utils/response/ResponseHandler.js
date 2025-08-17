/**
 * ResponseHandler - Manages how the bot responds to messages
 * Will handle different response types (replies, DMs, embeds) and formatting
 */
import { logger } from '../logger.js';
export class ResponseHandler {
    message;
    channel;
    user;
    constructor(message, channel, user) {
        this.message = message;
        this.channel = channel;
        this.user = user;
    }
    async sendText(content, options = {}) {
        try {
            await this.message.reply({
                content,
                ...options,
                allowedMentions: { repliedUser: false, ...options.allowedMentions }
            });
        }
        catch (error) {
            logger.error('Failed to send text response:', error);
            throw error;
        }
    }
    async sendEmbed(embed, options = {}) {
        try {
            await this.message.reply({
                embeds: [embed],
                ...options,
                allowedMentions: { repliedUser: false, ...options.allowedMentions }
            });
        }
        catch (error) {
            logger.error('Failed to send embed response:', error);
            throw error;
        }
    }
    async sendDM(content) {
        try {
            const dmChannel = await this.user.createDM();
            await dmChannel.send(content);
        }
        catch (error) {
            logger.error('Failed to send DM:', error);
            // Fall back to public channel if DM fails
            if (typeof content === 'string') {
                await this.sendText(`I couldn't send you a DM. Please check your privacy settings.\n> ${content}`);
            }
            else {
                await this.sendText("I couldn't send you a DM. Please check your privacy settings.");
            }
        }
    }
    async editMessage(messageId, content) {
        try {
            const message = await this.channel.messages.fetch(messageId);
            if (message.editable) {
                await message.edit(content);
            }
        }
        catch (error) {
            logger.error('Failed to edit message:', error);
            throw error;
        }
    }
    async addReaction(emoji) {
        try {
            await this.message.react(emoji);
        }
        catch (error) {
            logger.error('Failed to add reaction:', error);
            // Silently fail for reactions as they're not critical
        }
    }
    /**
     * Send a typing indicator in the channel
     * @param durationMs How long to show the typing indicator (max 10s)
     */
    async indicateTyping(durationMs = 5000) {
        if (!this.channel.isTextBased() || this.channel.isDMBased() || this.channel.isThread()) {
            return;
        }
        try {
            await this.channel.sendTyping();
            // Automatically stop typing after duration (max 10s as per Discord's limit)
            const typingDuration = Math.min(durationMs, 10000);
            if (typingDuration > 0) {
                setTimeout(() => this.stopTyping(), typingDuration);
            }
        }
        catch (error) {
            logger.warn('Failed to send typing indicator:', error);
        }
    }
    /**
     * Stop the typing indicator
     * Note: Discord.js doesn't provide a direct way to stop typing,
     * so this is a no-op. The typing indicator will automatically
     * stop after ~10 seconds or when a message is sent.
     */
    stopTyping() {
        // No-op - typing indicator stops automatically
    }
}
//# sourceMappingURL=ResponseHandler.js.map