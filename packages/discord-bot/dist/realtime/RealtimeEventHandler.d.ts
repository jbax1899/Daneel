import { EventEmitter } from 'events';
import { RealtimeEvent } from '../utils/realtimeService.js';
import { RealtimeWebSocketManager } from './RealtimeWebSocketManager.js';
export declare class RealtimeEventHandler extends EventEmitter {
    private wsManager;
    private isEventHandlersSetup;
    private audioBuffer;
    private isCollectingAudio;
    constructor();
    private setupInternalEventHandlers;
    handleEvent(event: RealtimeEvent): void;
    setupWebSocketEventHandlers(wsManager: RealtimeWebSocketManager): void;
    private cleanupWebSocketEventHandlers;
    waitForResponseCompleted(): Promise<void>;
    waitForAudioCollected(): Promise<void>;
}
