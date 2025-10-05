import type { ResponseOutputItem } from 'openai/resources/responses/responses.js';
import type { ImageGenerationQuality, ImageGenerationSize } from '../../utils/pricing.js';
export type ImageResponseModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano';
export type ImageQualityType = ImageGenerationQuality;
export type ImageSizeType = ImageGenerationSize;
export type ImageBackgroundType = 'auto' | 'transparent' | 'opaque';
export type ImageGenerationCallWithPrompt = ResponseOutputItem.ImageGenerationCall & {
    revised_prompt?: string | null;
};
export interface ReflectionFields {
    title: string | null;
    description: string | null;
    reflection: string | null;
    adjustedPrompt?: string | null;
}
export interface PartialImagePayload {
    index: number;
    base64: string;
}
export interface CloudinaryUsageMetadata {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    imageCount: number;
    combinedInputTokens: number;
    combinedOutputTokens: number;
    combinedTotalTokens: number;
}
export interface CloudinaryCostMetadata {
    text: number;
    image: number;
    total: number;
    perImage: number;
}
export interface UploadMetadata {
    originalPrompt: string;
    revisedPrompt?: string | null;
    title?: string | null;
    description?: string | null;
    reflectionMessage?: string | null;
    model: ImageResponseModel;
    quality: ImageQualityType;
    size: ImageSizeType;
    background: ImageBackgroundType;
    startTime: number;
    usage: CloudinaryUsageMetadata;
    cost: CloudinaryCostMetadata;
}
