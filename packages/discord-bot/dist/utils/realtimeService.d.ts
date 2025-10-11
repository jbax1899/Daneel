import { EventEmitter } from 'events';
export interface RealtimeSessionOptions {
    model?: 'gpt-realtime' | 'gpt-4o-realtime-preview' | 'gpt-4o-mini-realtime-preview';
    voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'nova' | 'onyx' | 'sage' | 'shimmer';
    instructions?: string;
    temperature?: number;
    maxResponseOutputTokens?: number;
}
export interface RealtimeEvent {
    type: string;
    [key: string]: any;
}
export interface AudioChunk {
    data: Buffer;
    timestamp: number;
}
export interface RealtimeResponseTextDeltaEvent {
    type: 'response.text.delta';
    delta: string;
}
export interface RealtimeResponseAudioDeltaEvent {
    type: 'response.audio.delta';
    delta: string;
}
export interface RealtimeResponseCompletedEvent {
    type: 'response.completed';
    response_id: string;
    [key: string]: any;
}
export interface RealtimeErrorEvent {
    type: 'error';
    error: {
        message: string;
        code: string;
        [key: string]: any;
    };
}
/**
* Manages a connection to OpenAI's Realtime API
*/
export declare class RealtimeSession extends EventEmitter {
    private wsManager;
    private audioHandler;
    private eventHandler;
    private sessionConfig;
    constructor(options?: RealtimeSessionOptions);
    /**
     * Connect to OpenAI's Realtime API
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the Realtime API
     */
    disconnect(): void;
    sendAudio(audioBuffer: Buffer, speakerLabel: string, speakerId?: string): Promise<void>;
    /**
     * Commit the current audio buffer for processing
     */
    commitAudio(): Promise<void>;
    /**
     * Clear the current audio buffer
     */
    clearAudio(): void;
    flushAudio(): Promise<void>;
    /**
     * Start a new conversation turn
     */
    createResponse(): void;
    waitForResponseCompleted(): Promise<void>;
    waitForAudioCollected(): Promise<void>;
    sendGreeting(): Promise<void>;
}
