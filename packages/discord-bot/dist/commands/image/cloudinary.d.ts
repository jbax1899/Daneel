import type { UploadMetadata } from './types.js';
export declare const isCloudinaryConfigured: boolean;
export declare class CloudinaryConfigurationError extends Error {
    constructor(message?: string);
}
export declare function uploadToCloudinary(imageBuffer: Buffer, metadata: UploadMetadata): Promise<string>;
