/**
 * @arete-risk: high
 * @arete-ethics: critical
 * 
 * RISK: Manages voice session state and coordinates audio event handling.
 * Currently handles session creation, audio chunk forwarding, and cleanup.
 * Session corruption can break voice functionality for multiple users.
 * 
 * ETHICS: Manages voice session data and participant tracking.
 * Currently handles audio event routing and session lifecycle management.
 * 
 * Manages voice sessions and real-time audio processing.
 * Handles session lifecycle, audio pipeline coordination, and user state tracking.
 * All voice sessions are logged and cost-tracked for transparency.
 */

import { VoiceConnection } from '@discordjs/voice';
import { RealtimeSession } from '../utils/realtimeService.js';
import { logger } from '../utils/logger.js';
import { AudioCaptureHandler, AudioChunkEvent } from './AudioCaptureHandler.js';
import { AudioPlaybackHandler } from './AudioPlaybackHandler.js';

export interface VoiceSession {
    connection: VoiceConnection;
    realtimeSession: RealtimeSession;
    audioCaptureHandler: AudioCaptureHandler;
    audioPlaybackHandler: AudioPlaybackHandler;
    isActive: boolean;
    lastAudioTime: number;
    initiatingUserId?: string;
    participantLabels: Map<string, string>;
    audioPipeline: Promise<void>;
}

export class VoiceSessionManager {
    private activeSessions: Map<string, VoiceSession> = new Map();

    public createSession(
        connection: VoiceConnection,
        realtimeSession: RealtimeSession,
        audioCaptureHandler: AudioCaptureHandler,
        audioPlaybackHandler: AudioPlaybackHandler,
        participants: Map<string, string>,
        initiatingUserId?: string,
    ): VoiceSession {
        return {
            connection,
            realtimeSession,
            audioCaptureHandler,
            audioPlaybackHandler,
            isActive: false,
            lastAudioTime: Date.now(),
            initiatingUserId,
            participantLabels: new Map(participants),
            audioPipeline: Promise.resolve(),
        };
    }

    public addSession(guildId: string, session: VoiceSession): void {
        logger.debug(`Adding session for guild ${guildId}, current sessions: ${this.activeSessions.size}`);

        const existingSession = this.activeSessions.get(guildId);
        if (existingSession) {
            logger.warn(`Session already exists for guild ${guildId}, cleaning up existing session`);
            this.cleanupSessionEventListeners(existingSession);
        }

        this.activeSessions.set(guildId, session);

        const chunkHandler = (event: AudioChunkEvent) => {
            if (event.guildId !== guildId) return;
            this.enqueueAudioTask(guildId, async () => {
                await this.forwardAudioChunk(guildId, event.userId, event.audioBuffer);
            });
        };

        const silenceHandler = (event: { guildId: string; userId: string }) => {
            if (event.guildId !== guildId) return;
            this.enqueueAudioTask(guildId, async () => {
                await this.flushRealtimeBuffer(guildId);
            });
        };

        session.audioCaptureHandler.on('audioChunk', chunkHandler);
        session.audioCaptureHandler.on('speakerSilence', silenceHandler);

        (session as any).audioChunkHandler = chunkHandler;
        (session as any).silenceHandler = silenceHandler;

        logger.debug(`Added voice session for guild ${guildId}, total sessions: ${this.activeSessions.size}`);
    }

    private enqueueAudioTask(guildId: string, task: () => Promise<void>): void {
        const session = this.activeSessions.get(guildId);
        if (!session) return;

        session.audioPipeline = session.audioPipeline
            .catch((error) => {
                logger.error(`Audio pipeline error for guild ${guildId}:`, error);
            })
            .then(task)
            .catch((error) => {
                logger.error(`Failed audio task for guild ${guildId}:`, error);
            });
    }

    private async forwardAudioChunk(guildId: string, userId: string, audioBuffer: Buffer): Promise<void> {
        const session = this.activeSessions.get(guildId);
        if (!session) {
            logger.warn(`No session found for guild ${guildId} when forwarding audio chunk`);
            return;
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            return;
        }

        const label = session.participantLabels.get(userId) || userId;
        logger.debug(`Forwarding ${audioBuffer.length} bytes for ${label} (${userId}) in guild ${guildId}`);

        await session.realtimeSession.sendAudio(audioBuffer, label, userId);
        session.lastAudioTime = Date.now();
    }

    private async flushRealtimeBuffer(guildId: string): Promise<void> {
        const session = this.activeSessions.get(guildId);
        if (!session) {
            return;
        }

        await session.realtimeSession.flushAudio();
    }

    private cleanupSessionEventListeners(session: VoiceSession): void {
        const chunkHandler = (session as any).audioChunkHandler;
        if (chunkHandler) {
            session.audioCaptureHandler.off('audioChunk', chunkHandler);
            delete (session as any).audioChunkHandler;
        }

        const silenceHandler = (session as any).silenceHandler;
        if (silenceHandler) {
            session.audioCaptureHandler.off('speakerSilence', silenceHandler);
            delete (session as any).silenceHandler;
        }
    }

    public updateParticipantLabel(guildId: string, userId: string, displayName: string): void {
        const session = this.activeSessions.get(guildId);
        if (!session) return;
        session.participantLabels.set(userId, displayName);
    }

    public removeParticipant(guildId: string, userId: string): void {
        const session = this.activeSessions.get(guildId);
        if (!session) return;
        session.participantLabels.delete(userId);
    }

    public getSession(guildId: string): VoiceSession | undefined {
        return this.activeSessions.get(guildId);
    }

    public removeSession(guildId: string): void {
        const session = this.activeSessions.get(guildId);
        if (session) {
            try {
                this.cleanupSessionEventListeners(session);
                session.realtimeSession.disconnect();
            } catch (error) {
                logger.error('Error disconnecting realtime session:', error);
            }
        }
        this.activeSessions.delete(guildId);
        logger.debug(`Removed voice session for guild ${guildId}, remaining sessions: ${this.activeSessions.size}`);
    }

    public getAllSessions(): Map<string, VoiceSession> {
        return this.activeSessions;
    }

    public hasSession(guildId: string): boolean {
        return this.activeSessions.has(guildId);
    }
}
