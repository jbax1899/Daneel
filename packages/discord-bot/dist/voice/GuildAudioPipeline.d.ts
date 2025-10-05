import { PassThrough } from 'stream';
import { opus } from 'prism-media';
import { AudioPlayer } from '@discordjs/voice';
export declare class GuildAudioPipeline {
    private readonly player;
    private readonly pcmStream;
    private readonly opusEncoder;
    private pcmBuffer;
    private isDestroyed;
    private readonly frameSize;
    private resourceCreated;
    constructor();
    writePCM(pcmData: Buffer): Promise<void>;
    flushResidualBuffer(): Promise<void>;
    getPlayer(): AudioPlayer;
    destroy(): Promise<void>;
    isIdle(): boolean;
    hasResource(): boolean;
    getPCMStream(): PassThrough;
    getOpusEncoder(): opus.Encoder;
    markResourceCreated(): void;
}
