import prism from 'prism-media';
import { AUDIO_CONSTANTS } from '../constants/voice.js';

type PCMResamplerOptions = {
    fromRate: number;
    toRate: number;
    channels?: number;
};

const createPCMResampler = ({ fromRate, toRate, channels = AUDIO_CONSTANTS.CHANNELS }: PCMResamplerOptions): prism.FFmpeg => {
    return new prism.FFmpeg({
        args: [
            '-loglevel', 'error',
            '-f', 's16le',
            '-ar', fromRate.toString(),
            '-ac', channels.toString(),
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', toRate.toString(),
            '-ac', channels.toString(),
            'pipe:1',
        ],
    });
};

export const createCaptureResampler = (): prism.FFmpeg =>
    createPCMResampler({
        fromRate: AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE,
        toRate: AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE,
    });

export const createPlaybackResampler = (): prism.FFmpeg =>
    createPCMResampler({
        fromRate: AUDIO_CONSTANTS.REALTIME_SAMPLE_RATE,
        toRate: AUDIO_CONSTANTS.DISCORD_SAMPLE_RATE,
    });
