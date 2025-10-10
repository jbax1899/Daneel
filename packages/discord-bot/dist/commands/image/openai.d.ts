import { OpenAI } from 'openai';
import type { Response } from 'openai/resources/responses/responses.js';
import type { ImageBackgroundType, ImageGenerationCallWithPrompt, ImageQualityType, ImageRenderModel, ImageSizeType, ImageStylePreset, ImageTextModel, PartialImagePayload, ReflectionFields } from './types.js';
interface GenerateImageOptions {
    openai: OpenAI;
    prompt: string;
    textModel: ImageTextModel;
    imageModel: ImageRenderModel;
    quality: ImageQualityType;
    size: ImageSizeType;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    username: string;
    nickname: string;
    guildName: string;
    allowPromptAdjustment: boolean;
    followUpResponseId?: string | null;
    onPartialImage?: (payload: PartialImagePayload) => Promise<void> | void;
}
interface GenerationOutcome {
    response: Response;
    imageCall: ImageGenerationCallWithPrompt;
    finalImageBase64: string;
    partialImages: string[];
    reflection: ReflectionFields;
}
export declare function generateImageWithReflection(options: GenerateImageOptions): Promise<GenerationOutcome>;
export {};
