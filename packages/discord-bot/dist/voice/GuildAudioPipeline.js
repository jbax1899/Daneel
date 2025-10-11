import { PassThrough } from 'stream';
import { opus } from 'prism-media';
import { createAudioPlayer, AudioPlayerStatus, NoSubscriberBehavior } from '@discordjs/voice';
import { once } from 'events';
import { AUDIO_CONSTANTS } from '../constants/voice.js';
import { logger } from '../utils/logger.js';
export class GuildAudioPipeline {
    player;
    pcmStream;
    opusEncoder;
    pcmBuffer = Buffer.alloc(0);
    isDestroyed = false;
    frameSize = AUDIO_CONSTANTS.DISCORD_FRAME_SIZE; // 48kHz * 0.02s = 960
    resourceCreated = false;
    constructor() {
        // Create a PassThrough stream for PCM data
        this.pcmStream = new PassThrough();
        // Create Opus encoder (48kHz, mono)
        this.opusEncoder = new opus.Encoder({
            frameSize: this.frameSize,
            channels: 1,
            rate: AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE,
        });
        // Create audio player
        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });
        // Increase max listeners to prevent warnings
        this.pcmStream.setMaxListeners(20);
        this.opusEncoder.setMaxListeners(20);
    }
    async writePCM(pcmData) {
        if (this.isDestroyed) {
            throw new Error('Cannot write to destroyed pipeline');
        }
        // Add new data to buffer
        this.pcmBuffer = Buffer.concat([this.pcmBuffer, pcmData]);
        // Process complete frames
        const frameSizeInBytes = this.frameSize * 2; // 2 bytes per sample (16-bit PCM)
        while (this.pcmBuffer.length >= frameSizeInBytes) {
            const frame = this.pcmBuffer.subarray(0, frameSizeInBytes);
            this.pcmBuffer = this.pcmBuffer.subarray(frameSizeInBytes);
            // Write the frame to the PCM stream
            if (!this.pcmStream.write(frame)) {
                await once(this.pcmStream, 'drain');
            }
        }
    }
    async flushResidualBuffer() {
        if (this.isDestroyed) {
            this.pcmBuffer = Buffer.alloc(0);
            return;
        }
        if (this.pcmBuffer.length === 0) {
            return;
        }
        const frameSizeInBytes = this.frameSize * 2;
        const remainder = this.pcmBuffer.length % frameSizeInBytes;
        if (remainder === 0) {
            return;
        }
        const padding = Buffer.alloc(frameSizeInBytes - remainder);
        await this.writePCM(padding);
    }
    getPlayer() {
        return this.player;
    }
    async destroy() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        // Drain remaining PCM data
        if (this.pcmBuffer.length > 0) {
            try {
                await this.writePCM(Buffer.alloc(0)); // flush remaining frames
            }
            catch { }
        }
        try {
            this.player.stop();
            this.pcmStream.end();
            this.opusEncoder.end();
        }
        catch (error) {
            logger.error('[AudioPipeline] Error ending streams:', error);
        }
    }
    isIdle() {
        return this.player.state.status === AudioPlayerStatus.Idle;
    }
    hasResource() {
        return this.resourceCreated;
    }
    getPCMStream() {
        return this.pcmStream;
    }
    getOpusEncoder() {
        return this.opusEncoder;
    }
    markResourceCreated() {
        this.resourceCreated = true;
    }
}
//# sourceMappingURL=GuildAudioPipeline.js.map