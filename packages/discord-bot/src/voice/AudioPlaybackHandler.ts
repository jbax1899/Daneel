import { AudioPlayer, VoiceConnection, AudioPlayerStatus, AudioPlayerError, createAudioResource, StreamType } from '@discordjs/voice';
import { logger } from '../utils/logger.js';
import { GuildAudioPipeline } from './GuildAudioPipeline.js';
import { upsampleToDiscord } from './audioTransforms.js';

const PIPELINE_IDLE_CLEANUP_DELAY_MS = 2000;
const QUEUE_RETRY_DELAY_MS = 100;

export class AudioPlaybackHandler {
    private pipelines: Map<string, GuildAudioPipeline> = new Map();
    private audioQueues: Map<string, Buffer[]> = new Map();
    private isProcessingQueue: Map<string, boolean> = new Map();
    private pipelineCleanupTimers: Map<string, NodeJS.Timeout> = new Map();
    private pipelineErrorHandlers: Map<string, (error: Error) => void> = new Map();
    private pipelinesBeingDestroyed: Set<string> = new Set();

    public async playAudioToChannel(connection: VoiceConnection, audioData: Buffer): Promise<void> {
        const guildId = connection.joinConfig.guildId;
        logger.debug(`[AudioPlayback] Adding audio chunk to queue for guild ${guildId}`);

        this.clearPipelineCleanupTimer(guildId);

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

        const encoderErrorHandler = (error: Error) => {
            if (this.pipelinesBeingDestroyed.has(guildId)) {
                if (error?.message === 'Premature close') {
                    logger.debug(`[AudioPlayback] Opus encoder closed while cleaning up guild ${guildId}`);
                } else {
                    logger.warn(`[AudioPlayback] Ignoring encoder error during cleanup for guild ${guildId}:`, error);
                }
                return;
            }

            if (error?.message === 'Premature close') {
                logger.debug(`[AudioPlayback] Opus encoder closed unexpectedly for guild ${guildId}, rebuilding pipeline`);
                const queue = this.audioQueues.get(guildId);
                this.cleanupPipeline(guildId);
                if (queue && queue.length > 0) {
                    this.retryProcessingQueue(connection);
                }
                return;
            }

            logger.error(`[AudioPlayback] Opus encoder error for guild ${guildId}:`, error);
            const queue = this.audioQueues.get(guildId);
            this.cleanupPipeline(guildId);
            if (queue && queue.length > 0) {
                this.retryProcessingQueue(connection);
            }
        };

        pipeline.getOpusEncoder().on('error', encoderErrorHandler);
        this.pipelineErrorHandlers.set(guildId, encoderErrorHandler);

        player.on(AudioPlayerStatus.Idle, () => {
            logger.debug(`[AudioPlayback] Player idle for guild ${guildId}, checking for more audio`);
            this.processAudioQueue(connection)
                .catch((error: Error) => {
                    logger.error(`[AudioPlayback] Error processing next item in queue:`, error);
                })
                .finally(() => {
                    const queue = this.audioQueues.get(guildId);
                    if (!queue || queue.length === 0) {
                        this.schedulePipelineCleanup(guildId);
                    }
                });
        });

        player.on('error', (error: AudioPlayerError) => {
            logger.error(`[AudioPlayback] Player error for guild ${guildId}:`, error);
            this.cleanupPipeline(guildId);
            this.retryProcessingQueue(connection);
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
            return;
        }

        if (this.isProcessingQueue.get(guildId)) {
            return;
        }

        this.isProcessingQueue.set(guildId, true);
        this.clearPipelineCleanupTimer(guildId);

        let encounteredError = false;

        try {
            while (queue.length > 0) {
                if (this.pipelinesBeingDestroyed.has(guildId)) {
                    encounteredError = true;
                    break;
                }

                const pipeline = this.ensurePipeline(connection);

                if (pipeline.isDestroyed()) {
                    encounteredError = true;
                    break;
                }

                if (!pipeline.hasResource()) {
                    const opusStream = pipeline.getPCMStream().pipe(pipeline.getOpusEncoder());
                    const resource = createAudioResource(opusStream, { inputType: StreamType.Opus, inlineVolume: true });
                    pipeline.getPlayer().play(resource);
                    pipeline.markResourceCreated();
                }

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
                    queue.unshift(audioData);
                    encounteredError = true;
                    this.cleanupPipeline(guildId);
                    break;
                }
            }

            if (!encounteredError && queue.length === 0) {
                const pipeline = this.pipelines.get(guildId);
                if (pipeline && !pipeline.isDestroyed()) {
                    await pipeline.flushResidualBuffer();
                }
            }
        } catch (error) {
            encounteredError = true;
            logger.error('[AudioPlayback] Error in processAudioQueue:', error);
            this.cleanupPipeline(guildId);
        } finally {
            this.isProcessingQueue.set(guildId, false);
        }

        if (encounteredError) {
            this.retryProcessingQueue(connection);
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

    private clearPipelineCleanupTimer(guildId: string): void {
        const timer = this.pipelineCleanupTimers.get(guildId);
        if (timer) {
            clearTimeout(timer);
            this.pipelineCleanupTimers.delete(guildId);
        }
    }

    private schedulePipelineCleanup(guildId: string): void {
        if (!this.pipelines.has(guildId) || this.pipelineCleanupTimers.has(guildId)) {
            return;
        }

        const timer = setTimeout(() => {
            this.pipelineCleanupTimers.delete(guildId);
            const queue = this.audioQueues.get(guildId);
            if (queue && queue.length > 0) {
                return;
            }
            this.cleanupPipeline(guildId);
        }, PIPELINE_IDLE_CLEANUP_DELAY_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }

        this.pipelineCleanupTimers.set(guildId, timer);
    }

    private retryProcessingQueue(connection: VoiceConnection): void {
        const guildId = connection.joinConfig.guildId;

        const timer = setTimeout(() => {
            const queue = this.audioQueues.get(guildId);
            if (!queue || queue.length === 0) {
                return;
            }

            if (this.isProcessingQueue.get(guildId)) {
                return;
            }

            if (connection.state.status === 'destroyed') {
                return;
            }

            void this.processAudioQueue(connection);
        }, QUEUE_RETRY_DELAY_MS);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    private cleanupPipeline(guildId: string): void {
        const pipeline = this.pipelines.get(guildId);
        if (pipeline) {
            const handler = this.pipelineErrorHandlers.get(guildId);
            const encoder = pipeline.getOpusEncoder();

            this.pipelinesBeingDestroyed.add(guildId);

            void pipeline.destroy().catch((error: Error) => {
                logger.error(`[AudioPlayback] Error cleaning up pipeline for guild ${guildId}:`, error);
            }).finally(() => {
                this.pipelinesBeingDestroyed.delete(guildId);
                if (handler) {
                    encoder.off('error', handler);
                    this.pipelineErrorHandlers.delete(guildId);
                }
            });
            this.pipelines.delete(guildId);
        }
        this.clearPipelineCleanupTimer(guildId);
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
        this.pipelineCleanupTimers.forEach((timer) => clearTimeout(timer));
        this.pipelineCleanupTimers.clear();
    }
}
