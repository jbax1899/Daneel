import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { RealtimeEventHandler } from './RealtimeEventHandler.js';

/**
 * Audio handler that manages buffer append and commit
 */
export class RealtimeAudioHandler {
    private pendingCommit: boolean = false;
    private lastAppendTime: number = 0;

    constructor() {
        // Initialize
    }

    public async sendAudio(ws: WebSocket, eventHandler: RealtimeEventHandler, audioBuffer: Buffer, _instructions: string = ''): Promise<void> {
        if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not connected');
        if (!audioBuffer || audioBuffer.length === 0) {
            logger.warn('[realtime] Ignoring empty audio buffer');
            return;
        }

        ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: audioBuffer.toString('base64') }));
        this.lastAppendTime = Date.now();
        this.pendingCommit = true;

        logger.debug(`[realtime] Sent audio chunk: ${audioBuffer.length} bytes`);

        await this.commitAudio(ws);   // commit & clear only

        // wait for server collection; response.create is triggered elsewhere (VoiceSessionManager)
        if (eventHandler) await eventHandler.waitForAudioCollected();
    }

    public async commitAudio(ws: WebSocket): Promise<void> {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }
    
        if (!this.pendingCommit) {
            logger.debug('[realtime] No pending audio to commit');
            return;
        }
    
        try {
            // Ensure a small delay after last append
            const timeSinceLastAppend = Date.now() - this.lastAppendTime;
            if (timeSinceLastAppend < 100) {
                await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastAppend));
            }
    
            // Send commit event
            ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            logger.debug('[realtime] Committed audio buffer');
    
            // Clear the local buffer
            this.clearAudio(ws);
        } catch (error) {
            logger.error('[realtime] Error committing audio:', error);
            throw error;
        } finally {
            this.pendingCommit = false;
        }
    }

    public sendResponseRequest(ws: WebSocket, instructions: string = ''): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
        const responseEvent = {
            type: 'response.create',
            response: {
                output_modalities: ['audio'],
                instructions,
            },
        };
        ws.send(JSON.stringify(responseEvent));
        logger.debug('[realtime] Sent response.create event');
    }    

    public clearAudio(ws: WebSocket): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            logger.debug('[realtime] WebSocket not ready for clear operation');
            return;
        }
    
        const clearEvent = {
            type: 'input_audio_buffer.clear'
        };
        
        ws.send(JSON.stringify(clearEvent));
        this.pendingCommit = false;
        
        logger.debug('[realtime] Cleared audio buffer');
    }

    public resetState(): void {
        this.pendingCommit = false;
        this.lastAppendTime = 0;
    }
}