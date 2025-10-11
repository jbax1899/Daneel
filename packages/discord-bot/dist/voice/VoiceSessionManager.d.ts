import { VoiceConnection } from '@discordjs/voice';
import { RealtimeSession } from '../utils/realtimeService.js';
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
    participantLabels: Map<string, string>;
    audioPipeline: Promise<void>;
}
export declare class VoiceSessionManager {
    private activeSessions;
    createSession(connection: VoiceConnection, realtimeSession: RealtimeSession, audioCaptureHandler: AudioCaptureHandler, audioPlaybackHandler: AudioPlaybackHandler, participants: Map<string, string>, initiatingUserId?: string): VoiceSession;
    addSession(guildId: string, session: VoiceSession): void;
    private enqueueAudioTask;
    private forwardAudioChunk;
    private flushRealtimeBuffer;
    private cleanupSessionEventListeners;
    updateParticipantLabel(guildId: string, userId: string, displayName: string): void;
    removeParticipant(guildId: string, userId: string): void;
    getSession(guildId: string): VoiceSession | undefined;
    removeSession(guildId: string): void;
    getAllSessions(): Map<string, VoiceSession>;
    hasSession(guildId: string): boolean;
}
