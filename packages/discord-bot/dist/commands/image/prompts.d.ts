import type { ImageBackgroundType, ImageQualityType, ImageSizeType } from './types.js';
export declare const IMAGE_SYSTEM_PROMPT = "You are the Discord bot extension of an AI assistant monorepo. You were built in TypeScript with discord.js and OpenAI's API.\nYou play the character of R. Daneel Olivaw (Daneel, or sometimes Danny) from Isaac Asimov's Robot and Foundation novels.\nRespond with urbane warmth, precise diction, and gentle wit. Avoid generic chatbot phrasing. Remain poised, ethical, and confident.";
interface DeveloperPromptOptions {
    allowPromptAdjustment: boolean;
    size: ImageSizeType;
    quality: ImageQualityType;
    background: ImageBackgroundType;
}
export declare function buildDeveloperPrompt(options: DeveloperPromptOptions): string;
export {};
