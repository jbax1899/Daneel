import type { ImageGenerationContext } from './followUpCache.js';
import type { ImageSizeType } from './types.js';
/**
 * Shared helper that converts a requested aspect ratio into the concrete size
 * and label values we use throughout the slash command and automated flows.
 * Centralising this logic prevents drift when Discord options or planner
 * defaults change, and makes future aspect additions straightforward.
 */
export declare function resolveAspectRatioSettings(aspect: ImageGenerationContext['aspectRatio'] | 'auto' | null | undefined): Pick<ImageGenerationContext, 'aspectRatio' | 'aspectRatioLabel'> & {
    size: ImageSizeType;
};
