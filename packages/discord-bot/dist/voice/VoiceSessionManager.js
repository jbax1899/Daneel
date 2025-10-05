import { logger } from '../utils/logger.js';
export class VoiceSessionManager {
    activeSessions = new Map();
    createSession(connection, realtimeSession, audioCaptureHandler, audioPlaybackHandler, participants, initiatingUserId) {
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
    addSession(guildId, session) {
        logger.debug(`Adding session for guild ${guildId}, current sessions: ${this.activeSessions.size}`);
        const existingSession = this.activeSessions.get(guildId);
        if (existingSession) {
            logger.warn(`Session already exists for guild ${guildId}, cleaning up existing session`);
            this.cleanupSessionEventListeners(existingSession);
        }
        this.activeSessions.set(guildId, session);
        const chunkHandler = (event) => {
            if (event.guildId !== guildId)
                return;
            this.enqueueAudioTask(guildId, async () => {
                await this.forwardAudioChunk(guildId, event.userId, event.audioBuffer);
            });
        };
        const silenceHandler = (event) => {
            if (event.guildId !== guildId)
                return;
            this.enqueueAudioTask(guildId, async () => {
                await this.flushRealtimeBuffer(guildId);
            });
        };
        session.audioCaptureHandler.on('audioChunk', chunkHandler);
        session.audioCaptureHandler.on('speakerSilence', silenceHandler);
        session.audioChunkHandler = chunkHandler;
        session.silenceHandler = silenceHandler;
        logger.debug(`Added voice session for guild ${guildId}, total sessions: ${this.activeSessions.size}`);
    }
    enqueueAudioTask(guildId, task) {
        const session = this.activeSessions.get(guildId);
        if (!session)
            return;
        session.audioPipeline = session.audioPipeline
            .catch((error) => {
            logger.error(`Audio pipeline error for guild ${guildId}:`, error);
        })
            .then(task)
            .catch((error) => {
            logger.error(`Failed audio task for guild ${guildId}:`, error);
        });
    }
    async forwardAudioChunk(guildId, userId, audioBuffer) {
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
    async flushRealtimeBuffer(guildId) {
        const session = this.activeSessions.get(guildId);
        if (!session) {
            return;
        }
        await session.realtimeSession.flushAudio();
    }
    cleanupSessionEventListeners(session) {
        const chunkHandler = session.audioChunkHandler;
        if (chunkHandler) {
            session.audioCaptureHandler.off('audioChunk', chunkHandler);
            delete session.audioChunkHandler;
        }
        const silenceHandler = session.silenceHandler;
        if (silenceHandler) {
            session.audioCaptureHandler.off('speakerSilence', silenceHandler);
            delete session.silenceHandler;
        }
    }
    updateParticipantLabel(guildId, userId, displayName) {
        const session = this.activeSessions.get(guildId);
        if (!session)
            return;
        session.participantLabels.set(userId, displayName);
    }
    removeParticipant(guildId, userId) {
        const session = this.activeSessions.get(guildId);
        if (!session)
            return;
        session.participantLabels.delete(userId);
    }
    getSession(guildId) {
        return this.activeSessions.get(guildId);
    }
    removeSession(guildId) {
        const session = this.activeSessions.get(guildId);
        if (session) {
            try {
                this.cleanupSessionEventListeners(session);
                session.realtimeSession.disconnect();
            }
            catch (error) {
                logger.error('Error disconnecting realtime session:', error);
            }
        }
        this.activeSessions.delete(guildId);
        logger.debug(`Removed voice session for guild ${guildId}, remaining sessions: ${this.activeSessions.size}`);
    }
    getAllSessions() {
        return this.activeSessions;
    }
    hasSession(guildId) {
        return this.activeSessions.has(guildId);
    }
}
//# sourceMappingURL=VoiceSessionManager.js.map