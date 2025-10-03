import { AudioPlayer, VoiceConnection, AudioPlayerStatus, AudioPlayerError, createAudioResource, StreamType } from '@discordjs/voice';
import { logger } from '../utils/logger.js';
import { GuildAudioPipeline } from './GuildAudioPipeline.js';

export class AudioPlaybackHandler {
    private pipelines: Map<string, GuildAudioPipeline> = new Map();
    private audioQueues: Map<string, Buffer[]> = new Map();
    private isProcessingQueue: Map<string, boolean> = new Map();

    public async playAudioToChannel(connection: VoiceConnection, audioData: Buffer): Promise<void> {
        const guildId = connection.joinConfig.guildId;
        logger.debug(`[AudioPlayback] Adding audio chunk to queue for guild ${guildId}`);
        
        // Initialize queue if it doesn't exist
        if (!this.audioQueues.has(guildId)) {
            this.audioQueues.set(guildId, []);
        }
        
        // Add the audio data to the queue
        const queue = this.audioQueues.get(guildId)!;
        queue.push(audioData);
        logger.debug(`[AudioPlayback] Added audio chunk to queue for guild ${guildId}, queue length: ${queue.length}`);

        // Ensure we have a pipeline for this guild
        this.ensurePipeline(connection);

        // If we're already processing the queue, just let it continue
        if (this.isProcessingQueue.get(guildId)) {
            return Promise.resolve();
        }

        // Process the queue if not already processing
        return this.processAudioQueue(connection);
    }
    
    private ensurePipeline(connection: VoiceConnection): GuildAudioPipeline {
        const guildId = connection.joinConfig.guildId;
        
        // Return existing pipeline if it exists
        if (this.pipelines.has(guildId)) {
            return this.pipelines.get(guildId)!;
        }
        
        // Create new pipeline
        logger.debug(`[AudioPlayback] Creating new audio pipeline for guild ${guildId}`);
        const pipeline = new GuildAudioPipeline();
        this.pipelines.set(guildId, pipeline);
        
        // Set up player event handlers
        const player = pipeline.getPlayer();
        
        player.on(AudioPlayerStatus.Idle, () => {
            logger.debug(`[AudioPlayback] Player idle for guild ${guildId}, checking for more audio`);
            // Process next item in queue
            this.processAudioQueue(connection).catch((error: Error) => {
                logger.error(`[AudioPlayback] Error processing next item in queue:`, error);
                this.isProcessingQueue.set(guildId, false);
            });
        });
        
        player.on('error', (error: AudioPlayerError) => {
            logger.error(`[AudioPlayback] Player error for guild ${guildId}:`, error);
            this.isProcessingQueue.set(guildId, false);
            // Clean up the broken pipeline
            this.cleanupPipeline(guildId);
            // Retry processing the queue after a short delay
            setTimeout(() => this.processAudioQueue(connection), 1000);
        });
        
        // Subscribe the connection to the player
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

            // If the player has no resource yet, create one pointing to the pipeline's PCM stream
            if (!pipeline.hasResource()) {
                const opusStream = pipeline.getPCMStream().pipe(pipeline.getOpusEncoder());
                const resource = createAudioResource(opusStream, { inputType: StreamType.Opus, inlineVolume: true });
                player.play(resource);
                pipeline.markResourceCreated();
            }
    
            while (queue.length > 0) {
                const audioData = queue.shift();
                if (!audioData) continue;
    
                try {
                    await pipeline.writePCM(audioData);
                } catch (error) {
                    logger.error('[AudioPlayback] Error writing audio data to pipeline:', error);
                }
            }
    
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
            try {
                pipeline.destroy();
            } catch (error) {
                logger.error(`[AudioPlayback] Error cleaning up pipeline for guild ${guildId}:`, error);
            }
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