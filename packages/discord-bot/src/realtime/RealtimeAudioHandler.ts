import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { AUDIO_CONSTANTS } from '../constants/voice.js';

const COMMIT_INACTIVITY_MS = 320;

interface PendingSpeaker {
    label: string;
    userId?: string;
}

/**
 * Buffers PCM audio chunks and sends them to the realtime API once speech pauses.
 */
export class RealtimeAudioHandler {
    private hasPendingAudio = false;
    private lastAppendTime = 0;
    private pendingSpeaker: PendingSpeaker | null = null;
    private commitTimer: NodeJS.Timeout | null = null;
    private pendingBytes = 0;
    private pendingChunks: Buffer[] = [];

    public async sendAudio(
        ws: WebSocket,
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
            await this.flushAudio(ws);
        }

        this.pendingSpeaker = { label: speakerLabel, userId: speakerId };
        this.lastAppendTime = Date.now();
        this.hasPendingAudio = true;
        this.pendingBytes += audioBuffer.length;
        this.pendingChunks.push(Buffer.from(audioBuffer));

        logger.debug(`[realtime] Buffered audio chunk (${audioBuffer.length} bytes) for ${speakerLabel}`);

        this.scheduleCommit(ws);
    }

    private scheduleCommit(ws: WebSocket): void {
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
        }

        this.commitTimer = setTimeout(() => {
            void this.flushAudio(ws).catch((error) => {
                logger.error('[realtime] Failed to flush audio buffer:', error);
            });
        }, COMMIT_INACTIVITY_MS);
    }

    public async flushAudio(ws: WebSocket): Promise<void> {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        if (!this.hasPendingAudio || this.pendingBytes === 0) {
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

        if (this.pendingBytes > 0 && this.pendingBytes < AUDIO_CONSTANTS.MIN_AUDIO_BUFFER_SIZE) {
            const deficit = AUDIO_CONSTANTS.MIN_AUDIO_BUFFER_SIZE - this.pendingBytes;
            const silence = Buffer.alloc(deficit);
            this.pendingChunks.push(silence);
            this.pendingBytes += deficit;
            logger.debug(`[realtime] Padded audio buffer with ${deficit} bytes of silence`);
        }

        const combinedAudio = Buffer.concat(this.pendingChunks);
        const audioContent = {
            type: 'input_audio' as const,
            audio: {
                format: {
                    type: 'audio/pcm',
                    rate: AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE,
                    channels: AUDIO_CONSTANTS.CHANNELS,
                },
                data: combinedAudio.toString('base64'),
            },
        };

        const content: Array<{ type: 'input_text'; text: string } | typeof audioContent> = [];

        if (this.pendingSpeaker) {
            const annotation = this.pendingSpeaker.userId
                ? `<discord_speaker id="${this.pendingSpeaker.userId}">${this.pendingSpeaker.label}</discord_speaker>`
                : `<discord_speaker>${this.pendingSpeaker.label}</discord_speaker>`;

            content.push({ type: 'input_text', text: annotation });
        }

        content.push(audioContent);

        ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content,
            },
        }));
        logger.debug('[realtime] Sent conversation item with audio payload');

        this.hasPendingAudio = false;
        this.pendingSpeaker = null;
        this.pendingBytes = 0;
        this.pendingChunks = [];

    }

    public clearAudio(ws: WebSocket): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            logger.debug('[realtime] WebSocket not ready for clear operation');
            return;
        }

        this.hasPendingAudio = false;
        this.pendingSpeaker = null;
        this.pendingBytes = 0;
        this.pendingChunks = [];
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }

        logger.debug('[realtime] Cleared audio buffer');
    }

    public resetState(): void {
        this.hasPendingAudio = false;
        this.pendingSpeaker = null;
        this.lastAppendTime = 0;
        this.pendingBytes = 0;
        this.pendingChunks = [];
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }
    }
}
