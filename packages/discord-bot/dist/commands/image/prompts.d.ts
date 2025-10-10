import type { ImageBackgroundType, ImageQualityType, ImageSizeType, ImageStylePreset } from './types.js';
interface DeveloperPromptOptions {
    allowPromptAdjustment: boolean;
    size: ImageSizeType;
    quality: ImageQualityType;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    username: string;
    nickname: string;
    guildName: string;
}
export declare function buildDeveloperPrompt(options: DeveloperPromptOptions): string;
export {};
