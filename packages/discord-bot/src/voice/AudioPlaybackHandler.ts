import { AudioPlayer, VoiceConnection, AudioPlayerStatus, AudioPlayerError, createAudioResource, StreamType } from '@discordjs/voice';
import { logger } from '../utils/logger.js';
import { GuildAudioPipeline } from './GuildAudioPipeline.js';
import { upsampleToDiscord } from './audioTransforms.js';

export class AudioPlaybackHandler {
    private pipelines: Map<string, GuildAudioPipeline> = new Map();
    private audioQueues: Map<string, Buffer[]> = new Map();
    private isProcessingQueue: Map<string, boolean> = new Map();

    public async playAudioToChannel(connection: VoiceConnection, audioData: Buffer): Promise<void> {
        const guildId = connection.joinConfig.guildId;
        logger.debug(`[AudioPlayback] Adding audio chunk to queue for guild ${guildId}`);

        if (!this.audioQueues.has(guildId)) {
            this.audioQueues.set(guildId, []);
        }

        const queue = this.audioQueues.get(guildId)!;
        queue.push(audioData);
        logger.debug(`[AudioPlayback] Added audio chunk to queue for guild ${guildId}, queue length: ${queue.length}`);

        this.ensurePipeline(connection);

        if (this.isProcessingQueue.get(guildId)) {
            return;
        }

        await this.processAudioQueue(connection);
    }

    private ensurePipeline(connection: VoiceConnection): GuildAudioPipeline {
        const guildId = connection.joinConfig.guildId;

        if (this.pipelines.has(guildId)) {
            return this.pipelines.get(guildId)!;
        }

        logger.debug(`[AudioPlayback] Creating new audio pipeline for guild ${guildId}`);
        const pipeline = new GuildAudioPipeline();
        this.pipelines.set(guildId, pipeline);

        const player = pipeline.getPlayer();

        player.on(AudioPlayerStatus.Idle, () => {
            logger.debug(`[AudioPlayback] Player idle for guild ${guildId}, checking for more audio`);
            this.processAudioQueue(connection).catch((error: Error) => {
                logger.error(`[AudioPlayback] Error processing next item in queue:`, error);
                this.isProcessingQueue.set(guildId, false);
            });
        });

        player.on('error', (error: AudioPlayerError) => {
            logger.error(`[AudioPlayback] Player error for guild ${guildId}:`, error);
            this.isProcessingQueue.set(guildId, false);
            this.cleanupPipeline(guildId);
            setTimeout(() => this.processAudioQueue(connection), 1000);
        });

        try {
            if (connection.state.status !== 'destroyed') {
                connection.subscribe(player);
            }
        } catch (error) {
            logger.error(`[AudioPlayback] Error subscribing connection for guild ${guildId}:`, error);
            this.cleanupPipeline(guildId);
            throw error;
        }

        return pipeline;
    }

    private async processAudioQueue(connection: VoiceConnection): Promise<void> {
        const guildId = connection.joinConfig.guildId;
        const queue = this.audioQueues.get(guildId);

        if (!queue || queue.length === 0) {
            logger.debug(`[AudioPlayback] Queue is empty for guild ${guildId}`);
            this.isProcessingQueue.set(guildId, false);
            return;
        }

        this.isProcessingQueue.set(guildId, true);

        try {
            const pipeline = this.pipelines.get(guildId);
            if (!pipeline) {
                throw new Error(`No pipeline found for guild ${guildId}`);
            }

            const player = pipeline.getPlayer();

            if (!pipeline.hasResource()) {
                const opusStream = pipeline.getPCMStream().pipe(pipeline.getOpusEncoder());
                const resource = createAudioResource(opusStream, { inputType: StreamType.Opus, inlineVolume: true });
                player.play(resource);
                pipeline.markResourceCreated();
            }

            while (queue.length > 0) {
                const audioData = queue.shift();
                if (!audioData || audioData.length === 0) {
                    continue;
                }

                try {
                    const pcmChunk = upsampleToDiscord(audioData);
                    if (pcmChunk.length === 0) {
                        continue;
                    }

                    await pipeline.writePCM(pcmChunk);
                } catch (error) {
                    logger.error('[AudioPlayback] Error writing audio data to pipeline:', error);
                }
            }
            await pipeline.flushResidualBuffer();

            this.isProcessingQueue.set(guildId, false);
        } catch (error) {
            logger.error('[AudioPlayback] Error in processAudioQueue:', error);
            this.isProcessingQueue.set(guildId, false);
            setTimeout(() => this.processAudioQueue(connection), 1000);
        }
    }

    public getPlayer(guildId: string): AudioPlayer | undefined {
        return this.pipelines.get(guildId)?.getPlayer();
    }

    public stopPlayback(guildId?: string): void {
        if (guildId) {
            this.cleanupPipeline(guildId);
            this.audioQueues.delete(guildId);
            this.isProcessingQueue.delete(guildId);
        } else {
            for (const gId of this.pipelines.keys()) {
                this.cleanupPipeline(gId);
                this.audioQueues.delete(gId);
                this.isProcessingQueue.delete(gId);
            }
        }
    }

    private cleanupPipeline(guildId: string): void {
        const pipeline = this.pipelines.get(guildId);
        if (pipeline) {
            void pipeline.destroy().catch((error: Error) => {
                logger.error(`[AudioPlayback] Error cleaning up pipeline for guild ${guildId}:`, error);
            });
            this.pipelines.delete(guildId);
        }
    }

    public cleanupGuild(guildId: string): void {
        this.cleanupPipeline(guildId);
        this.audioQueues.delete(guildId);
        this.isProcessingQueue.delete(guildId);
    }

    public cleanupAll(): void {
        for (const guildId of this.pipelines.keys()) {
            this.cleanupPipeline(guildId);
        }
        this.audioQueues.clear();
        this.isProcessingQueue.clear();
    }
}
