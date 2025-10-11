import { EventEmitter } from 'events';
import { RealtimeWebSocketManager } from '../realtime/RealtimeWebSocketManager.js';
import { RealtimeAudioHandler } from '../realtime/RealtimeAudioHandler.js';
import { RealtimeEventHandler } from '../realtime/RealtimeEventHandler.js';
import { RealtimeSessionConfig } from '../realtime/RealtimeSessionConfig.js';
/**
* Manages a connection to OpenAI's Realtime API
*/
export class RealtimeSession extends EventEmitter {
    wsManager;
    audioHandler;
    eventHandler;
    sessionConfig;
    constructor(options = {}) {
        super();
        this.wsManager = new RealtimeWebSocketManager();
        this.audioHandler = new RealtimeAudioHandler();
        this.eventHandler = new RealtimeEventHandler();
        this.sessionConfig = new RealtimeSessionConfig(options);
        // Forward all events from eventHandler to RealtimeSession
        this.eventHandler.on('event', (event) => {
            // Emit the event with its type
            this.emit(event.type, event);
        });
        // Special handling for audio events to ensure they're properly forwarded
        this.eventHandler.on('audio', (audioData) => {
            this.emit('audio', audioData);
        });
        // Forward text events
        this.eventHandler.on('text', (text) => {
            this.emit('text', text);
        });
    }
    /**
     * Connect to OpenAI's Realtime API
     */
    async connect() {
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${this.sessionConfig.getModel()}`;
        const headers = {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        };
        await this.wsManager.connect(wsUrl, headers);
        this.eventHandler.setupWebSocketEventHandlers(this.wsManager);
        // Send session configuration
        const ws = this.wsManager.getWebSocket();
        if (ws) {
            this.sessionConfig.sendSessionConfig(ws);
            this.sessionConfig.enableVAD(ws);
        }
    }
    /**
     * Disconnect from the Realtime API
     */
    disconnect() {
        this.wsManager.disconnect();
    }
    async sendAudio(audioBuffer, speakerLabel, speakerId) {
        const ws = this.wsManager.getWebSocket();
        if (ws && this.audioHandler) {
            await this.audioHandler.sendAudio(ws, this.eventHandler, audioBuffer, speakerLabel, speakerId);
        }
    }
    /**
     * Commit the current audio buffer for processing
     */
    async commitAudio() {
        await this.flushAudio();
    }
    /**
     * Clear the current audio buffer
     */
    clearAudio() {
        const ws = this.wsManager.getWebSocket();
        if (ws) {
            this.audioHandler.clearAudio(ws);
        }
    }
    async flushAudio() {
        const ws = this.wsManager.getWebSocket();
        if (ws && this.audioHandler) {
            await this.audioHandler.flushAudio(ws, this.eventHandler);
        }
    }
    /**
     * Start a new conversation turn
     */
    createResponse() {
        const ws = this.wsManager.getWebSocket();
        if (ws) {
            this.sessionConfig.createResponse(ws);
        }
    }
    async waitForResponseCompleted() {
        if (this.eventHandler) {
            return this.eventHandler.waitForResponseCompleted();
        }
        throw new Error('Event handler not initialized');
    }
    waitForAudioCollected() {
        if (this.eventHandler) {
            return this.eventHandler.waitForAudioCollected();
        }
        throw new Error('Event handler not initialized');
    }
    async sendGreeting() {
        const ws = this.wsManager.getWebSocket();
        if (!ws)
            return;
        await new Promise(resolve => setTimeout(resolve, 300));
        ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hello!' }] }
        }));
        ws.send(JSON.stringify({
            type: 'response.create',
            response: {
                output_modalities: ['audio'],
                instructions: (`${this.sessionConfig.getInstructions() ?? ''}` + " Say: Hello!").trim()
            }
        }));
    }
}
//# sourceMappingURL=realtimeService.js.map