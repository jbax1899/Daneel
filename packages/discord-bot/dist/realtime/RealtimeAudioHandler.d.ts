import WebSocket from 'ws';
import { RealtimeEventHandler } from './RealtimeEventHandler.js';
/**
 * Streams PCM audio to the realtime API and commits buffers on cadence.
 */
export declare class RealtimeAudioHandler {
    private pendingCommit;
    private lastAppendTime;
    private pendingSpeaker;
    private commitTimer;
    private pendingBytes;
    sendAudio(ws: WebSocket, eventHandler: RealtimeEventHandler, audioBuffer: Buffer, speakerLabel: string, speakerId?: string): Promise<void>;
    private scheduleCommit;
    flushAudio(ws: WebSocket, eventHandler: RealtimeEventHandler): Promise<void>;
    clearAudio(ws: WebSocket): void;
    resetState(): void;
}
