import { VoiceConnection } from '@discordjs/voice';
import { RealtimeSession } from '../utils/realtimeService.js';
import { logger } from '../utils/logger.js';
import { AudioCaptureHandler } from './AudioCaptureHandler.js';
import { AudioPlaybackHandler } from './AudioPlaybackHandler.js';

export interface VoiceSession {
    connection: VoiceConnection;
    realtimeSession: RealtimeSession;
    audioCaptureHandler: AudioCaptureHandler;
    audioPlaybackHandler: AudioPlaybackHandler;
    isActive: boolean;
    lastAudioTime: number;
    initiatingUserId?: string;
    isCreatingResponse?: boolean;
    ws?: WebSocket;
}

export class VoiceSessionManager {
    private activeSessions: Map<string, VoiceSession> = new Map();

    constructor() {
        // Initialize
    }

    public createSession(
        connection: VoiceConnection, 
        realtimeSession: RealtimeSession, 
        audioCaptureHandler: AudioCaptureHandler, 
        audioPlaybackHandler: AudioPlaybackHandler, 
        initiatingUserId?: string
    ): VoiceSession {
        const session: VoiceSession = {
            connection,
            realtimeSession,
            audioCaptureHandler,
            audioPlaybackHandler,
            isActive: false,
            lastAudioTime: Date.now(),
            initiatingUserId,
            isCreatingResponse: false
        };

        return session;
    }

    public addSession(guildId: string, session: VoiceSession): void {
        logger.debug(`Adding session for guild ${guildId}, current sessions: ${this.activeSessions.size}`);

        // Clean up any existing session
        const existingSession = this.activeSessions.get(guildId);
        if (existingSession) {
            logger.warn(`Session already exists for guild ${guildId}, cleaning up existing session`);
            this.cleanupSessionEventListeners(existingSession);
        }

        this.activeSessions.set(guildId, session);

        // Set up event listener for processing speaker audio
        const eventHandler = async (userId: string, audioBuffer: Buffer) => {
            logger.debug(`Received processSpeakerAudio event for user ${userId} in guild ${guildId}`);
            await this.processSpeakerAudioForSession(guildId, userId, audioBuffer);
        };

        session.audioCaptureHandler.on('processSpeakerAudio', eventHandler);
        (session as any).processSpeakerAudioHandler = eventHandler;

        logger.debug(`Added voice session for guild ${guildId}, total sessions: ${this.activeSessions.size}`);
    }

    private async processSpeakerAudioForSession(guildId: string, userId: string, audioBuffer: Buffer): Promise<void> {
        const session = this.activeSessions.get(guildId);
        if (!session) {
            logger.warn(`No session found for guild ${guildId} when processing speaker audio`);
            return;
        }

        // Prevent concurrent response creation
        if (session.isCreatingResponse) {
            logger.warn(`Already creating response for guild ${guildId}, skipping`);
            return;
        }

        session.isCreatingResponse = true;
        logger.debug(`Processing ${audioBuffer.length} bytes of audio for user ${userId} in guild ${guildId}`);

        try {
            // Verify session is still active
            if (!this.activeSessions.has(guildId)) {
                logger.warn(`Session destroyed for guild ${guildId} during processing`);
                return;
            }

            logger.debug(`Sending ${audioBuffer.length} bytes to realtime session`);
            
            // Send audio chunks
            await session.realtimeSession.sendAudio(audioBuffer);

            // Small delay to ensure server processes the commit
            await new Promise(resolve => setTimeout(resolve, 100));

            // Wait for server acknowledgment
            try {
                await session.realtimeSession.waitForAudioCollected();
                logger.debug(`Audio collected by server for guild ${guildId}`);
            } catch (error) {
                logger.warn(`Timeout waiting for audio collection:`, error);
            }

            // Create response if session is still active
            if (this.activeSessions.has(guildId)) {
                logger.debug(`Creating response for guild ${guildId}`);
                
                try {
                    // Create the response
                    session.realtimeSession.createResponse();
                    
                    // Wait for response completion (with timeout)
                    const responseTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Response timeout')), 10000)
                    );
                    
                    await Promise.race([
                        session.realtimeSession.waitForResponseCompleted(),
                        responseTimeout
                    ]);
                    
                    logger.debug(`Response completed for guild ${guildId}`);
                } catch (error) {
                    if (error instanceof Error && error.message === 'Response timeout') {
                        logger.warn(`Response timeout for guild ${guildId}`);
                    } else {
                        logger.error(`Error during response creation for guild ${guildId}:`, error);
                    }
                }
            }

        } catch (error) {
            logger.error(`Error processing audio for guild ${guildId}:`, error);
        } finally {
            // Reset the flag after a short delay to prevent race conditions
            setTimeout(() => {
                if (session) {
                    session.isCreatingResponse = false;
                }
            }, 500);
        }
    }

    private cleanupSessionEventListeners(session: VoiceSession): void {
        const handler = (session as any).processSpeakerAudioHandler;
        if (handler) {
            session.audioCaptureHandler.off('processSpeakerAudio', handler);
            delete (session as any).processSpeakerAudioHandler;
        }
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