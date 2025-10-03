import { VoiceConnection } from '@discordjs/voice';
import { RealtimeSession } from '../utils/realtimeService.js';
import { logger } from '../utils/logger.js';
import prism from 'prism-media';
import { AUDIO_CONSTANTS, TIMEOUT_CONSTANTS } from '../constants/voice.js';
import { createCaptureResampler } from './audioTransforms.js';
import { getVoiceConnection } from '@discordjs/voice';
import { EventEmitter } from 'events';

export class AudioCaptureHandler extends EventEmitter {
    private activeCaptures: Set<string> = new Set();
    private captureInitialized: Set<string> = new Set();
    private pendingResponsePerUser: Map<string, boolean> = new Map();
    private speakerQueue: Map<string, { guildId: string, userId: string, audioBuffer: Buffer, timestamp: number }> = new Map();
    private isProcessingQueue = false;

    constructor() {
        super();
        // Initialize
    }

    public setupAudioCapture(connection: VoiceConnection, realtimeSession: RealtimeSession, guildId: string): void {
        const receiver = connection.receiver;

        // Only setup once per guild
        if (this.captureInitialized.has(guildId)) {
            logger.debug(`Audio capture already initialized for guild ${guildId}`);
            return;
        }

        try {
            receiver.speaking.removeAllListeners('start');
        } catch (error) {
            // Ignore errors when removing listeners
        }

        receiver.speaking.on('start', (userId: string) => {
            this.handleUserStartedSpeaking(receiver, realtimeSession, guildId, userId);
        });

        this.captureInitialized.add(guildId);
        logger.debug(`Audio capture setup completed for guild ${guildId}`);
    }

    private handleUserStartedSpeaking(receiver: any, realtimeSession: RealtimeSession, guildId: string, userId: string): void {
        const captureKey = `${guildId}:${userId}`;
        if (this.activeCaptures.has(captureKey)) {
            logger.debug(`[${captureKey}] Already capturing audio for this user`);
            return;
        }

        this.activeCaptures.add(captureKey);
        logger.debug(`[${captureKey}] Starting audio capture for user`);

        const opusStream = receiver.subscribe(userId, {
            end: { 
                behavior: 'afterSilence', 
                duration: TIMEOUT_CONSTANTS.SILENCE_DURATION 
            },
        });

        const pcmStream = opusStream.pipe(
            new prism.opus.Decoder({
                rate: AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE,
                channels: AUDIO_CONSTANTS.CHANNELS,
                frameSize: AUDIO_CONSTANTS.DISCORD_FRAME_SIZE
            })
        );

        const ffmpegResampler = createCaptureResampler();

        const resampledStream = pcmStream.pipe(ffmpegResampler);

        // Create a local buffer for THIS specific speaking session
        const audioChunks: Buffer[] = [];
        let isProcessing = false;
        let silenceTimer: NodeJS.Timeout;
        let lastDataTime = Date.now();

        const processAudio = async () => {
            if (isProcessing) {
                logger.debug(`[${captureKey}] Already processing audio, skipping`);
                return;
            }

            isProcessing = true;
            clearTimeout(silenceTimer);

            try {
                logger.debug(`[${captureKey}] Processing audio with ${audioChunks.length} chunks`);
                await this.handleSpeakingEnded(captureKey, audioChunks, guildId, realtimeSession);
            } catch (error) {
                logger.error(`[${captureKey}] Error in processAudio:`, error);
                this.activeCaptures.delete(captureKey);
                this.pendingResponsePerUser.set(captureKey, false);
                realtimeSession.clearAudio();
            } finally {
                audioChunks.length = 0;
                isProcessing = false;
            }
        };

        // Set up a timeout to force processing if no end event is received
        const resetSilenceTimer = () => {
            clearTimeout(silenceTimer);
            lastDataTime = Date.now();
            
            silenceTimer = setTimeout(() => {
                const timeSinceLastData = Date.now() - lastDataTime;
                logger.debug(`[${captureKey}] Silence timeout reached (${timeSinceLastData}ms since last data), forcing audio processing`);
                processAudio();
            }, TIMEOUT_CONSTANTS.SILENCE_DURATION * 2); // Slightly longer than the silence duration
        };

        resampledStream.on('data', (chunk: Buffer) => {
            logger.debug(`[${captureKey}] Received resampled PCM chunk: ${chunk.length} bytes`);
            audioChunks.push(chunk);
            resetSilenceTimer();
        });

        resampledStream.on('end', () => {
            const duration = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0) / (AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE * 2) * 1000;
            logger.debug(`[${captureKey}] Resampled PCM stream ended after ${duration.toFixed(0)}ms, processing audio...`);
            processAudio();
        });

        ffmpegResampler.on('error', (err: Error) => {
            logger.error(`[${captureKey}] FFmpeg resampler error:`, err);
        });

        opusStream.on('error', (err: Error) => {
            logger.error(`[${captureKey}] Opus stream error:`, err);
            clearTimeout(silenceTimer);
            this.activeCaptures.delete(captureKey);
            this.pendingResponsePerUser.set(captureKey, false);
            realtimeSession.clearAudio();
            audioChunks.length = 0;
        });
        
        // Start the initial timer
        resetSilenceTimer();
    }

    private isIntentionalSpeech(audioChunks: Buffer[]): boolean {
        const totalAudioBytes = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const chunkCount = audioChunks.length;

        // Calculate duration in milliseconds (16-bit mono at 24kHz)
        const durationMs = (totalAudioBytes / 2 / AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE) * 1000;

        // Intent indicators: duration > 300ms AND multiple chunks (not just noise)
        const isIntentional = durationMs > 300 && chunkCount > 3;

        logger.debug(`Intent detection: ${durationMs.toFixed(1)}ms, ${chunkCount} chunks -> ${isIntentional ? 'INTENTIONAL' : 'NOISE'}`);

        return isIntentional;
    }

    private async queueSpeakerAudio(guildId: string, userId: string, audioBuffer: Buffer): Promise<void> {
        const queueKey = `${guildId}:${userId}`;

        this.speakerQueue.set(queueKey, {
            guildId,
            userId,
            audioBuffer,
            timestamp: Date.now()
        });

        logger.debug(`Queued audio for ${queueKey}, queue size: ${this.speakerQueue.size}`);

        // Process queue if not already processing
        if (!this.isProcessingQueue) {
            await this.processSpeakerQueue();
        }
    }

    private currentlyProcessingAudio: Set<string> = new Set();

    private async processSpeakerQueue(): Promise<void> {
        if (this.isProcessingQueue || this.speakerQueue.size === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Process speakers in chronological order (oldest first)
            const sortedSpeakers = Array.from(this.speakerQueue.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);

            logger.debug(`Processing speaker queue with ${sortedSpeakers.length} items`);

            for (const [queueKey, speaker] of sortedSpeakers) {
                // Check if we're already processing this user's audio
                const processingKey = `${queueKey}:${speaker.audioBuffer.length}`;
                if (this.currentlyProcessingAudio.has(processingKey)) {
                    logger.debug(`Already processing audio for ${queueKey}, skipping duplicate`);
                    this.speakerQueue.delete(queueKey);
                    continue;
                }

                this.currentlyProcessingAudio.add(processingKey);
                logger.debug(`Processing queued audio for ${queueKey}`);

                // Wait for any ongoing response to complete
                const captureKey = queueKey;
                const canProceed = await this.waitForPreviousResponse(captureKey);

                if (canProceed) {
                    this.pendingResponsePerUser.set(captureKey, true);

                    try {
                        // Send the queued audio to the realtime session via event
                        const listenerCount = this.listenerCount('processSpeakerAudio');
                        logger.debug(`Emitting processSpeakerAudio event for ${queueKey} with ${speaker.audioBuffer.length} bytes (${listenerCount} listeners)`);
                        this.emit('processSpeakerAudio', speaker.userId, speaker.audioBuffer);
                        logger.debug(`Successfully emitted processSpeakerAudio event for ${queueKey}`);
                    } catch (error) {
                        logger.error(`Error emitting processSpeakerAudio event:`, error);
                    } finally {
                        this.pendingResponsePerUser.set(captureKey, false);
                        this.currentlyProcessingAudio.delete(processingKey);
                        this.speakerQueue.delete(queueKey);
                    }
                } else {
                    // Skip this speaker if we timed out waiting
                    logger.debug(`Skipping queued audio for ${queueKey} due to timeout`);
                    this.currentlyProcessingAudio.delete(processingKey);
                    this.speakerQueue.delete(queueKey);
                }
            }
        } catch (error) {
            logger.error(`Error in processSpeakerQueue:`, error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    private async handleSpeakingEnded(captureKey: string, audioChunks: Buffer[], guildId: string, _realtimeSession: RealtimeSession): Promise<void> {
        logger.debug(`[${captureKey}] handleSpeakingEnded called with ${audioChunks.length} chunks, total ${audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)} bytes`);

        // Check if voice connection is still active
        const connection = getVoiceConnection(guildId);
        if (!connection) {
            logger.debug(`[${captureKey}] Voice connection destroyed, skipping audio processing`);
            this.activeCaptures.delete(captureKey);
            return;
        }

        // Concatenate all chunks from the LOCAL buffer
        const audioBuffer = Buffer.concat(audioChunks);
        logger.debug(`[${captureKey}] Audio buffer created: ${audioBuffer.length} bytes`);

        // Use intent detection to filter out noise
        if (!this.isIntentionalSpeech(audioChunks)) {
            logger.debug(`[${captureKey}] Audio appears to be noise, skipping`);
            this.activeCaptures.delete(captureKey);
            return;
        }

        logger.debug(`[${captureKey}] Intentional speech detected, queuing for processing`);

        // Extract user ID from capture key
        const [guild, userId] = captureKey.split(':');

        // Queue the audio for processing instead of processing immediately
        await this.queueSpeakerAudio(guild, userId, audioBuffer);

        this.activeCaptures.delete(captureKey);
    }

    private async waitForPreviousResponse(captureKey: string): Promise<boolean> {
        const maxWaitTime = TIMEOUT_CONSTANTS.MAX_RESPONSE_WAIT_TIME;
        const startTime = Date.now();

        while (this.pendingResponsePerUser.get(captureKey) && (Date.now() - startTime) < maxWaitTime) {
            logger.debug(`Waiting for previous response for ${captureKey} to finish...`);
            await new Promise(resolve => setTimeout(resolve, TIMEOUT_CONSTANTS.RESPONSE_POLLING_INTERVAL));
        }

        const timedOut = (Date.now() - startTime) >= maxWaitTime;
        if (timedOut) {
            logger.warn(`Timeout waiting for previous response for ${captureKey}`);
        }

        return !timedOut;
    }

    public isCaptureActive(captureKey: string): boolean {
        return this.activeCaptures.has(captureKey);
    }

    public isCaptureInitialized(guildId: string): boolean {
        return this.captureInitialized.has(guildId);
    }

    public cleanupPendingResponse(captureKey: string): void {
        this.pendingResponsePerUser.delete(captureKey);
    }

    public cleanupGuild(guildId: string): void {
        // Clean up any pending responses for this guild
        const pendingKeysToRemove = Array.from(this.pendingResponsePerUser.keys()).filter(key => key.startsWith(`${guildId}:`));
        pendingKeysToRemove.forEach(key => this.pendingResponsePerUser.delete(key));

        // Clear any queued audio for users in this guild
        const queueKeysToRemove = Array.from(this.speakerQueue.keys()).filter(key => key.startsWith(`${guildId}:`));
        queueKeysToRemove.forEach(key => this.speakerQueue.delete(key));

        // Clear any currently processing audio for users in this guild
        const processingKeysToRemove = Array.from(this.currentlyProcessingAudio.values()).filter(key => key.startsWith(`${guildId}:`));
        processingKeysToRemove.forEach(key => this.currentlyProcessingAudio.delete(key));

        logger.debug(`Cleaned up audio capture for guild ${guildId}`);
    }

    public getDebugInfo(): any {
        return {
            activeCaptures: this.activeCaptures.size,
            captureInitialized: this.captureInitialized.size,
            pendingResponsePerUser: this.pendingResponsePerUser.size,
            speakerQueue: this.speakerQueue.size,
            currentlyProcessingAudio: this.currentlyProcessingAudio.size,
            isProcessingQueue: this.isProcessingQueue,
            processSpeakerAudioListeners: this.listenerCount('processSpeakerAudio')
        };
    }
}
