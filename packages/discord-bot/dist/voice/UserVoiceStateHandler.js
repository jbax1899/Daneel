import { logger } from '../utils/logger.js';
import { getVoiceConnection } from '@discordjs/voice';
import { cleanupVoiceConnection } from './VoiceConnectionManager.js';
export class UserVoiceStateHandler {
    initiatingUsers = new Map();
    sessionManager;
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
    }
    async handleUserVoiceChange(oldState, newState, client, startConversationCallback) {
        const guildId = newState.guild.id;
        const member = newState.member;
        // Skip if this is a bot (to avoid self-triggering)
        if (member?.user.bot)
            return;
        logger.debug(`[handleUserVoiceChange] Voice state change in guild ${guildId} (${newState.guild.name}):`);
        logger.debug(`- Member: ${member?.user.tag} (${member?.id})`);
        logger.debug(`- Old channel: ${oldState.channelId} (${oldState.channel?.name})`);
        logger.debug(`- New channel: ${newState.channelId} (${newState.channel?.name})`);
        // Get the bot's voice channel
        const botVoiceChannel = newState.guild.members.me?.voice.channel;
        if (!botVoiceChannel) {
            logger.debug(`[handleUserVoiceChange] Bot is not in a voice channel in guild ${guildId}`);
            return;
        }
        logger.debug(`[handleUserVoiceChange] Bot is in voice channel: ${botVoiceChannel.id} (${botVoiceChannel.name})`);
        // User joined the bot's voice channel
        if ((!oldState.channelId || oldState.channelId !== botVoiceChannel.id) &&
            newState.channelId === botVoiceChannel.id) {
            await this.handleUserJoinedBotChannel(newState, botVoiceChannel, client, startConversationCallback);
        }
        // User left the bot's voice channel
        else if (oldState.channelId === botVoiceChannel.id &&
            (!newState.channelId || newState.channelId !== botVoiceChannel.id)) {
            await this.handleUserLeftBotChannel(oldState, botVoiceChannel, guildId, client);
        }
    }
    async handleUserJoinedBotChannel(newState, botVoiceChannel, client, startConversationCallback) {
        const user = newState.member?.user;
        const guildId = newState.guild.id;
        if (!user) {
            logger.warn(`[handleUserVoiceChange] User object is null or undefined`);
            return;
        }
        logger.info(`[handleUserVoiceChange] User ${user.tag} (${user.id}) joined voice channel ${botVoiceChannel.name}`);
        const displayName = newState.member?.displayName || user.username;
        this.sessionManager.updateParticipantLabel(guildId, user.id, displayName);
        // Double-check the bot is still in the voice channel
        const currentBotChannel = newState.guild.members.me?.voice.channel;
        if (!currentBotChannel || currentBotChannel.id !== botVoiceChannel.id) {
            logger.warn(`[handleUserVoiceChange] Bot is no longer in the expected voice channel`);
            return;
        }
        // Start the conversation if this is the initiating user
        const initiatingUserId = this.initiatingUsers.get(guildId);
        if (user && initiatingUserId === user.id) {
            try {
                await startConversationCallback(guildId);
                logger.info(`Successfully started conversation with ${user.tag} in ${botVoiceChannel.name}`);
            }
            catch (error) {
                logger.error('Error starting conversation:', error);
                // If conversation fails, clean up the connection
                const connection = getVoiceConnection(guildId);
                if (connection) {
                    await cleanupVoiceConnection(connection, client);
                }
            }
        }
    }
    async handleUserLeftBotChannel(oldState, botVoiceChannel, guildId, client) {
        const user = oldState.member?.user;
        logger.info(`User ${user?.tag || 'Unknown'} left voice channel ${botVoiceChannel.name}`);
        if (user) {
            this.sessionManager.removeParticipant(guildId, user.id);
        }
        // If the bot is alone in the voice channel, clean up
        if (botVoiceChannel.members.size <= 1) {
            logger.info('Bot is alone in the voice channel, cleaning up...');
            const connection = getVoiceConnection(guildId);
            if (connection) {
                await cleanupVoiceConnection(connection, client);
            }
            logger.info(`Cleaned up voice connection in guild ${guildId}`);
        }
    }
    registerInitiatingUser(guildId, userId) {
        logger.debug(`[registerInitiatingUser] Starting registration for guild ${guildId}, user ${userId}`);
        this.initiatingUsers.set(guildId, userId);
        logger.debug(`[registerInitiatingUser] Stored initiating user ${userId} for guild ${guildId}`);
    }
    getInitiatingUser(guildId) {
        return this.initiatingUsers.get(guildId);
    }
    clearInitiatingUser(guildId) {
        this.initiatingUsers.delete(guildId);
    }
}
//# sourceMappingURL=UserVoiceStateHandler.js.map