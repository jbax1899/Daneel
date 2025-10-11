import WebSocket from 'ws';
import { RealtimeSessionOptions } from '../utils/realtimeService.js';
export declare class RealtimeSessionConfig {
    private options;
    constructor(options?: RealtimeSessionOptions);
    getOptions(): RealtimeSessionOptions;
    updateOptions(newOptions: Partial<RealtimeSessionOptions>): void;
    getModel(): string;
    getVoice(): string;
    getInstructions(): string | undefined;
    sendSessionConfig(ws: WebSocket): void;
    createResponse(ws: WebSocket): void;
    enableVAD(ws: WebSocket): void;
}
