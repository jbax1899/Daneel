import { VoiceConnection } from '@discordjs/voice';
import { EventEmitter } from 'events';
interface AudioChunkEvent {
    guildId: string;
    userId: string;
    audioBuffer: Buffer;
}
export declare class AudioCaptureHandler extends EventEmitter {
    private readonly captureInitialized;
    private readonly activeReceivers;
    constructor();
    setupAudioCapture(connection: VoiceConnection, _unusedRealtimeSession: unknown, guildId: string): void;
    isCaptureInitialized(guildId: string): boolean;
    private getCaptureKey;
    private startReceiverStream;
    private emitSpeakerSilence;
    cleanupGuild(guildId: string): void;
    getDebugInfo(): any;
}
export type { AudioChunkEvent };
