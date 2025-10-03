import { AUDIO_CONSTANTS } from '../constants/voice.js';

const BYTES_PER_SAMPLE = 2; // 16-bit PCM

/**
 * Resamples 16-bit mono PCM audio between sample rates using linear interpolation.
 * The implementation avoids the need for an external FFmpeg binary which proved
 * unreliable in some deployment environments and resulted in empty capture buffers.
 */
export const resamplePCM = (buffer: Buffer, fromRate: number, toRate: number): Buffer => {
    if (buffer.length === 0 || fromRate === toRate) {
        return Buffer.from(buffer);
    }

    const inputSampleCount = Math.floor(buffer.length / BYTES_PER_SAMPLE);
    if (inputSampleCount === 0) {
        return Buffer.alloc(0);
    }

    const resampleRatio = toRate / fromRate;
    const outputSampleCount = Math.max(1, Math.floor(inputSampleCount * resampleRatio));
    const outputBuffer = Buffer.allocUnsafe(outputSampleCount * BYTES_PER_SAMPLE);

    for (let i = 0; i < outputSampleCount; i++) {
        const sourceIndex = i / resampleRatio;
        const lowerIndex = Math.floor(sourceIndex);
        const upperIndex = Math.min(lowerIndex + 1, inputSampleCount - 1);
        const interpolation = sourceIndex - lowerIndex;

        const lowerSample = buffer.readInt16LE(lowerIndex * BYTES_PER_SAMPLE);
        const upperSample = buffer.readInt16LE(upperIndex * BYTES_PER_SAMPLE);

        const sampleValue = lowerSample + (upperSample - lowerSample) * interpolation;
        outputBuffer.writeInt16LE(Math.round(sampleValue), i * BYTES_PER_SAMPLE);
    }

    return outputBuffer;
};

export const downsampleToRealtime = (buffer: Buffer): Buffer =>
    resamplePCM(buffer, AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE, AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE);

export const upsampleToDiscord = (buffer: Buffer): Buffer =>
    resamplePCM(buffer, AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE, AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE);
