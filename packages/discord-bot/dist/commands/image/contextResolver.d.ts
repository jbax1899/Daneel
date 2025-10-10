import type { Message } from 'discord.js';
import type { ImageGenerationContext } from './followUpCache.js';
interface RecoveredContextDetails {
    context: ImageGenerationContext;
    /**
     * The response identifier associated with the embed. This is required when
     * we want to request true variations from the API rather than starting a
     * fresh generation.
     */
    responseId: string | null;
    /**
     * The input identifier, if available. This allows callers to chain
     * multiple variations by falling back to the previous response when an
     * embed predates the field update that surfaces output IDs.
     */
    inputId: string | null;
}
/**
 * Rebuilds the image generation context from the embed that announced the
 * image. We intentionally keep this synchronous so callers can reuse the logic
 * during interaction handling without awaiting network I/O.
 */
export interface RecoveredImageContext extends RecoveredContextDetails {
}
export declare function recoverContextFromMessage(message: Message): Promise<ImageGenerationContext | null>;
export declare function recoverContextDetailsFromMessage(message: Message): Promise<RecoveredImageContext | null>;
export {};
