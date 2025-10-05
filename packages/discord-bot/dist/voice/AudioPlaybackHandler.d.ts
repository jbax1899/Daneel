import { AudioPlayer, VoiceConnection } from '@discordjs/voice';
export declare class AudioPlaybackHandler {
    private pipelines;
    private audioQueues;
    private isProcessingQueue;
    private pipelineCleanupTimers;
    playAudioToChannel(connection: VoiceConnection, audioData: Buffer): Promise<void>;
    private ensurePipeline;
    private processAudioQueue;
    getPlayer(guildId: string): AudioPlayer | undefined;
    stopPlayback(guildId?: string): void;
    private clearPipelineCleanupTimer;
    private schedulePipelineCleanup;
    private retryProcessingQueue;
    private cleanupPipeline;
    cleanupGuild(guildId: string): void;
    cleanupAll(): void;
}
