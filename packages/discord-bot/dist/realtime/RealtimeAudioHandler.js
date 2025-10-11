import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { AUDIO_CONSTANTS } from '../constants/voice.js';
const COMMIT_INACTIVITY_MS = 320;
/**
 * Streams PCM audio to the realtime API and commits buffers on cadence.
 */
export class RealtimeAudioHandler {
    pendingCommit = false;
    lastAppendTime = 0;
    pendingSpeaker = null;
    commitTimer = null;
    pendingBytes = 0;
    async sendAudio(ws, eventHandler, audioBuffer, speakerLabel, speakerId) {
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
        this.pendingBytes += audioBuffer.length;
        logger.debug(`[realtime] Sent audio chunk (${audioBuffer.length} bytes) for ${speakerLabel}`);
        this.scheduleCommit(ws, eventHandler);
    }
    scheduleCommit(ws, eventHandler) {
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
        }
        this.commitTimer = setTimeout(() => {
            void this.flushAudio(ws, eventHandler).catch((error) => {
                logger.error('[realtime] Failed to flush audio buffer:', error);
            });
        }, COMMIT_INACTIVITY_MS);
    }
    async flushAudio(ws, eventHandler) {
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
        if (this.pendingBytes > 0 && this.pendingBytes < AUDIO_CONSTANTS.MIN_AUDIO_BUFFER_SIZE) {
            const deficit = AUDIO_CONSTANTS.MIN_AUDIO_BUFFER_SIZE - this.pendingBytes;
            const silence = Buffer.alloc(deficit);
            ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: silence.toString('base64'),
            }));
            this.pendingBytes += deficit;
            logger.debug(`[realtime] Padded audio buffer with ${deficit} bytes of silence`);
        }
        if (this.pendingSpeaker) {
            const annotation = this.pendingSpeaker.userId
                ? `<discord_speaker id="${this.pendingSpeaker.userId}">${this.pendingSpeaker.label}</discord_speaker>`
                : `<discord_speaker>${this.pendingSpeaker.label}</discord_speaker>`;
            ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        { type: 'input_text', text: annotation },
                        { type: 'input_audio_buffer' },
                    ],
                },
            }));
        }
        ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        logger.debug('[realtime] Committed audio buffer');
        this.pendingCommit = false;
        this.pendingSpeaker = null;
        this.pendingBytes = 0;
        try {
            await eventHandler.waitForAudioCollected();
        }
        catch (error) {
            logger.warn('[realtime] Error waiting for audio collection:', error);
        }
    }
    clearAudio(ws) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            logger.debug('[realtime] WebSocket not ready for clear operation');
            return;
        }
        ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        this.pendingCommit = false;
        this.pendingSpeaker = null;
        this.pendingBytes = 0;
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }
        logger.debug('[realtime] Cleared audio buffer');
    }
    resetState() {
        this.pendingCommit = false;
        this.pendingSpeaker = null;
        this.lastAppendTime = 0;
        this.pendingBytes = 0;
        if (this.commitTimer) {
            clearTimeout(this.commitTimer);
            this.commitTimer = null;
        }
    }
}
//# sourceMappingURL=RealtimeAudioHandler.js.map