import { Events, Client, VoiceState, ClientEvents, VoiceBasedChannel, GuildMember } from 'discord.js';
import { Event } from './Event.js';
import { getVoiceConnection, VoiceConnection } from '@discordjs/voice';
import { RealtimeSession } from '../utils/realtimeService.js';
import { logger } from '../utils/logger.js';
import { VoiceSessionManager } from '../voice/VoiceSessionManager.js';
import { AudioCaptureHandler } from '../voice/AudioCaptureHandler.js';
import { AudioPlaybackHandler } from '../voice/AudioPlaybackHandler.js';
import { UserVoiceStateHandler } from '../voice/UserVoiceStateHandler.js';
import { VoiceConnectionManager } from '../voice/VoiceConnectionManager.js';
import { RealtimeContextBuilder, RealtimeContextParticipant } from '../utils/prompting/RealtimeContextBuilder.js';
import { RealtimeUsageLimiter } from '../utils/RealtimeUsageLimiter.js';
import type { VoiceSession } from '../voice/VoiceSessionManager.js';
import type { RealtimeAllowance } from '../utils/RealtimeUsageLimiter.js';

export class VoiceStateHandler extends Event {
    private sessionManager: VoiceSessionManager;
    private audioCaptureHandler: AudioCaptureHandler;
    private audioPlaybackHandler: AudioPlaybackHandler;
    private userVoiceStateHandler: UserVoiceStateHandler;
    private connectionManager: VoiceConnectionManager;
    private client: Client;
    private realtimeContextBuilder: RealtimeContextBuilder;
    private realtimeUsageLimiter: RealtimeUsageLimiter;
    private farewellMessage: string;
    private responseCompletionGraceMs: number;

    constructor(client: Client) {
        super({
            name: Events.VoiceStateUpdate as keyof ClientEvents,
            once: false
        });

        this.client = client;
        this.sessionManager = new VoiceSessionManager();
        this.audioCaptureHandler = new AudioCaptureHandler();
        this.audioPlaybackHandler = new AudioPlaybackHandler();
        this.userVoiceStateHandler = new UserVoiceStateHandler(this.sessionManager);
        this.connectionManager = new VoiceConnectionManager();
        this.realtimeContextBuilder = new RealtimeContextBuilder();

        const limitMinutes = Number(process.env.REALTIME_LIMIT_MINUTES ?? '1');
        const windowHours = Number(process.env.REALTIME_LIMIT_WINDOW_HOURS ?? '24');
        const completionGrace = Number(process.env.REALTIME_COMPLETION_GRACE_MS ?? '10000');

        const parsedLimitMinutes = Number.isFinite(limitMinutes) && limitMinutes > 0 ? limitMinutes : 1;
        const parsedWindowHours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 24;
        const parsedCompletionGrace = Number.isFinite(completionGrace) && completionGrace > 0 ? completionGrace : 10_000;

        this.realtimeUsageLimiter = new RealtimeUsageLimiter({
            limitMinutes: parsedLimitMinutes,
            windowHours: parsedWindowHours,
            superUserIds: process.env.DEVELOPER_USER_ID ? [process.env.DEVELOPER_USER_ID] : undefined,
        });
        this.farewellMessage = process.env.REALTIME_FAREWELL_MESSAGE
            ?? 'It was great chatting with you! Let\'s talk again soon.';
        this.responseCompletionGraceMs = parsedCompletionGrace;

        logger.debug(`[VoiceStateHandler] Realtime usage limit configured: ${parsedLimitMinutes} minute(s) every ${parsedWindowHours} hour(s).`);

        try {
            const anyClient = this.client as any;
            if (anyClient && anyClient.handlers && typeof anyClient.handlers.set === 'function') {
                anyClient.handlers.set('voiceState', this);
            }
        } catch {}
    }

    async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
        try {
            if (newState.member?.id === this.client.user?.id) {
                await this.handleBotVoiceStateChange(oldState, newState);
            } else {
                await this.userVoiceStateHandler.handleUserVoiceChange(
                    oldState,
                    newState,
                    this.client,
                    this.startConversation.bind(this)
                );
            }
        } catch (error) {
            logger.error('Error in VoiceStateHandler execute:', error);
        }
    }

    private async handleBotVoiceStateChange(oldState: VoiceState, newState: VoiceState): Promise<void> {
        if (!oldState.channelId && newState.channelId) {
            await this.handleBotJoinedChannel(newState);
        } else if (oldState.channelId && !newState.channelId) {
            await this.handleBotLeftChannel(oldState);
        }
    }

    private async handleBotJoinedChannel(newState: VoiceState): Promise<void> {
        const guildId = newState.guild.id;
        logger.info(`Bot joined voice channel ${newState.channelId} in guild ${guildId}`);

        if (this.sessionManager.hasSession(guildId)) {
            logger.debug(`Active session already exists for guild ${guildId}, skipping initialization`);
            return;
        }

        const connection = getVoiceConnection(guildId);
        if (!connection) {
            logger.warn(`No voice connection found for guild ${guildId} after join`);
            return;
        }

        const voiceChannel = newState.channel;
        const { participantMap, contextParticipants } = this.collectVoiceParticipants(voiceChannel);

        const realtimeSession = await this.createRealtimeSession(guildId, contextParticipants);

        const session = this.sessionManager.createSession(
            connection,
            realtimeSession,
            this.audioCaptureHandler,
            this.audioPlaybackHandler,
            participantMap,
            this.userVoiceStateHandler.getInitiatingUser(guildId)
        );
        this.sessionManager.addSession(guildId, session);

        if (!this.audioCaptureHandler.isCaptureInitialized(guildId)) {
            this.audioCaptureHandler.setupAudioCapture(connection, realtimeSession, guildId);
        }

        logger.info('Voice session initialized successfully');
    }

    private collectVoiceParticipants(channel: VoiceBasedChannel | null): {
        participantMap: Map<string, string>;
        contextParticipants: RealtimeContextParticipant[];
    } {
        const participantMap = new Map<string, string>();
        const contextParticipants: RealtimeContextParticipant[] = [];

        if (!channel) {
            return { participantMap, contextParticipants };
        }

        channel.members.forEach((member: GuildMember) => {
            const displayName = member.displayName || member.user.username;
            participantMap.set(member.id, displayName);
            contextParticipants.push({
                id: member.id,
                displayName,
                isBot: member.user.bot,
            });
        });

        return { participantMap, contextParticipants };
    }

    public registerInitiatingUser(guildId: string, userId: string): void {
        this.userVoiceStateHandler.registerInitiatingUser(guildId, userId);
    }

    public getRealtimeAllowance(userId: string): RealtimeAllowance {
        return this.realtimeUsageLimiter.getAllowance(userId);
    }

    public async createSession(guildId: string, channelId: string): Promise<void> {
        if (this.sessionManager.hasSession(guildId)) {
            logger.debug(`Active session already exists for guild ${guildId}, skipping creation`);
            return;
        }

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error(`Guild ${guildId} not found`);

        const voiceChannel = guild.channels.cache.get(channelId);
        if (!voiceChannel?.isVoiceBased()) throw new Error(`Voice channel ${channelId} not found`);

        const connection = getVoiceConnection(guildId);
        if (!connection) throw new Error('No voice connection found for this guild');

        const { participantMap, contextParticipants } = this.collectVoiceParticipants(voiceChannel);
        const realtimeSession = await this.createRealtimeSession(guildId, contextParticipants);

        const session = this.sessionManager.createSession(
            connection,
            realtimeSession,
            this.audioCaptureHandler,
            this.audioPlaybackHandler,
            participantMap,
            this.userVoiceStateHandler.getInitiatingUser(guildId)
        );
        this.sessionManager.addSession(guildId, session);

        this.audioCaptureHandler.setupAudioCapture(connection, realtimeSession, guildId);

        logger.info(`Voice session created for guild ${guildId} in channel ${channelId}`);
    }

    private async handleBotLeftChannel(oldState: VoiceState): Promise<void> {
        const guildId = oldState.guild.id;
        logger.info(`Bot left voice channel in guild ${guildId}`);

        const session = this.sessionManager.getSession(guildId);
        if (session?.usageLimitTimer) {
            clearTimeout(session.usageLimitTimer);
            session.usageLimitTimer = undefined;
        }
        if (session?.initiatingUserId) {
            this.realtimeUsageLimiter.endSession(session.initiatingUserId);
        }
        if (session?.realtimeSession) {
            this.removeRealtimeSessionListeners(session.realtimeSession);
        }

        this.sessionManager.removeSession(guildId);
        this.userVoiceStateHandler.clearInitiatingUser(guildId);
        this.audioCaptureHandler.cleanupGuild(guildId);
        this.audioPlaybackHandler.cleanupGuild(guildId);
    }

    private async startConversation(guildId: string): Promise<void> {
        let session = this.sessionManager.getSession(guildId);

        if (!session) {
            logger.info(`[VoiceStateHandler] No session exists, creating for guild ${guildId}`);
            const connection = getVoiceConnection(guildId);
            if (!connection) throw new Error('No voice connection found for this guild');

            const guild = this.client.guilds.cache.get(guildId);
            const channelId = connection.joinConfig.channelId;
            const voiceChannel = channelId ? guild?.channels.cache.get(channelId) : null;
            const isVoiceChannel = voiceChannel && voiceChannel.isVoiceBased()
                ? (voiceChannel as VoiceBasedChannel)
                : null;

            const { participantMap, contextParticipants } = this.collectVoiceParticipants(isVoiceChannel);
            const realtimeSession = await this.createRealtimeSession(guildId, contextParticipants);
            session = this.sessionManager.createSession(
                connection,
                realtimeSession,
                this.audioCaptureHandler,
                this.audioPlaybackHandler,
                participantMap,
                this.userVoiceStateHandler.getInitiatingUser(guildId)
            );
            this.sessionManager.addSession(guildId, session);
            this.audioCaptureHandler.setupAudioCapture(connection, realtimeSession, guildId);
        }

        try {
            logger.info(`Started conversation in guild ${guildId}`);
            await this.activateRealtimeLimit(guildId, session);
            await session.realtimeSession.sendGreeting("Hello! I'm Daneel, your AI assistant. How can I help you?");
            session.isActive = true;
        } catch (error) {
            if (session?.initiatingUserId) {
                this.realtimeUsageLimiter.cancelSession(session.initiatingUserId);
            }
            logger.error(`Error starting conversation in guild ${guildId}:`, error);
            throw error;
        }
    }

    private async activateRealtimeLimit(guildId: string, session: VoiceSession): Promise<void> {
        const userId = session.initiatingUserId;
        if (!userId) {
            logger.debug(`[VoiceStateHandler] No initiating user found for guild ${guildId}, skipping realtime limiter.`);
            return;
        }

        try {
            const active = this.realtimeUsageLimiter.startSession(userId);
            session.usageLimitStartedAt = active.start;
            session.usageLimitAllowedMs = active.allowedMs;

            if (session.usageLimitTimer) {
                clearTimeout(session.usageLimitTimer);
            }

            if (Number.isFinite(active.allowedMs) && active.allowedMs > 0) {
                session.usageLimitTimer = setTimeout(() => {
                    void this.handleRealtimeLimitReached(guildId, userId);
                }, active.allowedMs);
                logger.debug(`[VoiceStateHandler] Scheduled realtime limit for user ${userId} in guild ${guildId} after ${active.allowedMs} ms.`);
            } else {
                session.usageLimitTimer = undefined;
            }
        } catch (error) {
            logger.error(`[VoiceStateHandler] Failed to start realtime session for user ${userId} in guild ${guildId}:`, error);
            throw error;
        }
    }

    private async handleRealtimeLimitReached(guildId: string, userId: string): Promise<void> {
        const session = this.sessionManager.getSession(guildId);
        if (!session) {
            return;
        }

        if (session.initiatingUserId !== userId) {
            return;
        }

        if (session.usageLimitTimer) {
            clearTimeout(session.usageLimitTimer);
            session.usageLimitTimer = undefined;
        }

        logger.info(`[VoiceStateHandler] Realtime usage limit reached for user ${userId} in guild ${guildId}. Ending session.`);

        await this.waitForResponseCompletion(session.realtimeSession, this.responseCompletionGraceMs);

        try {
            await session.realtimeSession.sendFarewell(this.farewellMessage);
            await this.waitForResponseCompletion(session.realtimeSession, this.responseCompletionGraceMs);
        } catch (error) {
            logger.error('[VoiceStateHandler] Failed to send farewell message before disconnecting:', error);
        }

        this.realtimeUsageLimiter.endSession(userId);

        try {
            this.removeRealtimeSessionListeners(session.realtimeSession);
        } catch (error) {
            logger.warn('[VoiceStateHandler] Failed to remove realtime session listeners during limit enforcement:', error);
        }

        this.sessionManager.removeSession(guildId);
        this.userVoiceStateHandler.clearInitiatingUser(guildId);
        this.audioCaptureHandler.cleanupGuild(guildId);
        this.audioPlaybackHandler.cleanupGuild(guildId);
        session.isActive = false;

        try {
            await this.connectionManager.cleanupVoiceConnection(session.connection, this.client);
        } catch (error) {
            logger.error('[VoiceStateHandler] Failed to cleanup voice connection after limit enforcement:', error);
        }
    }

    private async waitForResponseCompletion(realtimeSession: RealtimeSession, timeoutMs: number): Promise<void> {
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            await realtimeSession.waitForResponseCompleted().catch(() => undefined);
            return;
        }

        await Promise.race([
            realtimeSession.waitForResponseCompleted().catch(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
        ]);
    }

    private async createRealtimeSession(
        guildId: string,
        participants: RealtimeContextParticipant[],
    ): Promise<RealtimeSession> {
        this.audioCaptureHandler.cleanupGuild(guildId);

        const context = this.realtimeContextBuilder.buildContext({ participants });
        const realtimeSession = new RealtimeSession({
            instructions: context.instructions,
        });

        // Attach listeners only once
        if (!(realtimeSession as any).listenersAttached) {
            (realtimeSession as any).listenersAttached = true;

            realtimeSession.on('audio', (audioData: Buffer) => {
                if (!audioData || audioData.length === 0) return;

                const session = this.sessionManager.getSession(guildId);
                if (!session) return;

                void this.audioPlaybackHandler.playAudioToChannel(session.connection, audioData)
                    .catch((error) => {
                        logger.error('[VoiceStateHandler] Error queuing realtime audio for playback:', error);
                    });
            });

            realtimeSession.on('text', (text: string) => logger.debug(`[BOT TEXT] ${text}`));
            realtimeSession.on('greeting', (text: string) => logger.info(`[BOT GREETING] ${text}`));
            realtimeSession.on('response.completed', (event: any) => logger.debug(`[BOT RESPONSE COMPLETED] Response ID: ${event?.response_id || 'unknown'}`));
            realtimeSession.on('response.output_audio.done', (event: any) => logger.debug('[BOT AUDIO DONE] Audio stream completed for ' + event));
            realtimeSession.on('error', (error: Error) => logger.error('[RealtimeSession] Error:', error));

            realtimeSession.on('connected', () => logger.info('[RealtimeSession] Connected to OpenAI Realtime API'));
        }

        await realtimeSession.connect();
        return realtimeSession;
    }

    private removeRealtimeSessionListeners(session: RealtimeSession) {
        session.removeAllListeners();
    }

    public async cleanupExistingConnections(): Promise<void> {
        await this.connectionManager.cleanupExistingConnections(this.client);
    }
}

export async function cleanupVoiceConnection(connection: VoiceConnection | null, client: Client): Promise<void> {
    const manager = new VoiceConnectionManager();
    return manager.cleanupVoiceConnection(connection, client);
}

export default VoiceStateHandler;