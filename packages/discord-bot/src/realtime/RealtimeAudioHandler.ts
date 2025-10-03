import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { RealtimeEventHandler } from './RealtimeEventHandler.js';

const COMMIT_INACTIVITY_MS = 320;

interface PendingSpeaker {
    label: string;
    userId?: string;
}

/**
 * Streams PCM audio to the realtime API and commits buffers on cadence.
 */
export class RealtimeAudioHandler {
    private pendingCommit = false;
    private lastAppendTime = 0;
    private pendingSpeaker: PendingSpeaker | null = null;
    private commitTimer: NodeJS.Timeout | null = null;

    public async sendAudio(
        ws: WebSocket,
        eventHandler: RealtimeEventHandler,
        audioBuffer: Buffer,
        speakerLabel: string,
        speakerId?: string,
    ): Promise<void> {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }
        if (!audioBuffer || audioBuffer.length === 0) {
            logger.debug('[realtime] Ignoring empty audio buffer');
            return;
        }

        if (this.pendingSpeaker && this.pendingSpeaker.label !== speakerLabel) {
            await this.flushAudio(ws, eventHandler);
        }

        ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audioBuffer.toString('base64'),
        }));

        this.pendingSpeaker = { label: speakerLabel, userId: speakerId };
        this.lastAppendTime = Date.now();
        this.pendingCommit = true;

        logger.debug(`[realtime] Sent audio chunk (${audioBuffer.length} bytes) for ${speakerLabel}`);

        this.scheduleCommit(ws, eventHandler);
    }

    private scheduleCommit(ws: WebSocket, eventHandler: RealtimeEventHandler): void {
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
        }

        this.commitTimer = setTimeout(() => {
            void this.flushAudio(ws, eventHandler).catch((error) => {
                logger.error('[realtime] Failed to flush audio buffer:', error);
            });
        }, COMMIT_INACTIVITY_MS);
    }

    public async flushAudio(ws: WebSocket, eventHandler: RealtimeEventHandler): Promise<void> {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        if (!this.pendingCommit) {
            return;
        }

        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }

        const elapsed = Date.now() - this.lastAppendTime;
        if (elapsed < 20) {
            await new Promise(resolve => setTimeout(resolve, 20 - elapsed));
        }

        if (this.pendingSpeaker) {
            ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_audio_buffer' }],
                    metadata: {
                        speaker: this.pendingSpeaker.label,
                        user_id: this.pendingSpeaker.userId,
                    },
                },
            }));
        }

        ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        logger.debug('[realtime] Committed audio buffer');

        this.pendingCommit = false;
        this.pendingSpeaker = null;

        try {
            await eventHandler.waitForAudioCollected();
        } catch (error) {
            logger.warn('[realtime] Error waiting for audio collection:', error);
        }
    }

    public clearAudio(ws: WebSocket): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            logger.debug('[realtime] WebSocket not ready for clear operation');
            return;
        }

        ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        this.pendingCommit = false;
        this.pendingSpeaker = null;
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }

        logger.debug('[realtime] Cleared audio buffer');
    }

    public resetState(): void {
        this.pendingCommit = false;
        this.pendingSpeaker = null;
        this.lastAppendTime = 0;
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }
    }
}
