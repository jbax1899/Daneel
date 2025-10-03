import { PassThrough } from 'stream';
import { opus } from 'prism-media';
import { AudioPlayer, createAudioPlayer, AudioPlayerStatus, NoSubscriberBehavior } from '@discordjs/voice';
import { logger } from '../utils/logger.js';
import { once } from 'events';
import { AUDIO_CONSTANTS } from '../constants/voice.js';

export class GuildAudioPipeline {
    private readonly player: AudioPlayer;
    private readonly pcmStream: PassThrough;
    private readonly opusEncoder: opus.Encoder;
    private pcmBuffer: Buffer = Buffer.alloc(0);
    private isDestroyed: boolean = false;
    private readonly frameSize: number = AUDIO_CONSTANTS.DISCORD_FRAME_SIZE; // 48kHz * 0.02s = 960
    private resourceCreated = false;

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
        
        // Set up error handling for the encoder
        this.opusEncoder.on('error', (error: Error) => {
            logger.error('[AudioPipeline] Opus encoder error:', error);
        });

        // Increase max listeners to prevent warnings
        this.pcmStream.setMaxListeners(20);
        this.opusEncoder.setMaxListeners(20);  
    }
    
    public async writePCM(pcmData: Buffer): Promise<void> {
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
    
    public getPlayer(): AudioPlayer {
        return this.player;
    }
    
    public async destroy(): Promise<void> {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
    
        // Drain remaining PCM data
        if (this.pcmBuffer.length > 0) {
            try {
                await this.writePCM(Buffer.alloc(0)); // flush remaining frames
            } catch {}
        }
    
        try {
            this.player.stop();
            this.pcmStream.end();
            this.opusEncoder.end();
        } catch (error) {
            logger.error('[AudioPipeline] Error ending streams:', error);
        }
    }
    
    public isIdle(): boolean {
        return this.player.state.status === AudioPlayerStatus.Idle;
    }

    public hasResource(): boolean {
        return this.resourceCreated;
    }

    public getPCMStream(): PassThrough {
        return this.pcmStream;
    }

    public getOpusEncoder(): opus.Encoder {
        return this.opusEncoder;
    }

    public markResourceCreated(): void {
        this.resourceCreated = true;
    }
}
