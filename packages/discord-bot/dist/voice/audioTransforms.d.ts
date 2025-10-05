import { Transform } from 'stream';
/**
 * Resamples 16-bit mono PCM audio between sample rates using linear interpolation.
 * The implementation avoids the need for an external FFmpeg binary which proved
 * unreliable in some deployment environments and resulted in empty capture buffers.
 */
export declare const resamplePCM: (buffer: Buffer, fromRate: number, toRate: number) => Buffer;
export declare const createCaptureResampler: () => Transform;
export declare const createPlaybackResampler: () => Transform;
export declare const downsampleToRealtime: (buffer: Buffer) => Buffer;
export declare const upsampleToDiscord: (buffer: Buffer) => Buffer;
