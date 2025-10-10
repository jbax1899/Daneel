import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import type { ImageRenderModel, ImageStylePreset, ImageTextModel, PartialImagePayload, ReflectionFields } from './types.js';
import type { ImageGenerationContext } from './followUpCache.js';
/**
 * Provides structured metadata about a generated image so that different
 * presentation layers (slash commands, automated responses, button retries)
 * can render consistent messages without duplicating the cost/upload logic.
 */
export interface ImageGenerationArtifacts {
    responseId: string | null;
    textModel: ImageTextModel;
    imageModel: ImageRenderModel;
    revisedPrompt: string | null;
    finalStyle: ImageStylePreset;
    reflection: ReflectionFields;
    reflectionMessage: string;
    finalImageBuffer: Buffer;
    finalImageFileName: string;
    imageUrl: string | null;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        imageCount: number;
    };
    costs: {
        text: number;
        image: number;
        total: number;
        perImage: number;
    };
    generationTimeMs: number;
}
interface ExecuteImageGenerationOptions {
    followUpResponseId?: string | null;
    onPartialImage?: (payload: PartialImagePayload) => Promise<void> | void;
    user: {
        username: string;
        nickname: string;
        guildName: string;
    };
}
/**
 * Runs the OpenAI image pipeline, uploads the final asset, and returns a
 * normalized payload describing the generation. The caller is responsible for
 * presenting the result (embed, plain message, etc.) and for caching follow-up
 * context entries.
 */
export declare function executeImageGeneration(context: ImageGenerationContext, options: ExecuteImageGenerationOptions): Promise<ImageGenerationArtifacts>;
/**
 * Represents the Discord message payload that should be sent once image
 * generation completes. Centralising the layout keeps slash-command,
 * automated, and retry flows perfectly in sync while making it easy to
 * recover metadata from embeds if the process restarts.
 */
export interface ImageResultPresentation {
    content?: string;
    embed: EmbedBuilder;
    attachments: AttachmentBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
    followUpContext: ImageGenerationContext;
}
/**
 * Builds the embed, attachments, and follow-up controls that should be sent
 * when an image generation task finishes. The resulting embed always embeds
 * machine-readable fields (model, prompt sections, etc.) to make reboot
 * recovery possible via Discord's native message history.
 */
export declare function buildImageResultPresentation(context: ImageGenerationContext, artifacts: ImageGenerationArtifacts, { followUpResponseId }?: {
    followUpResponseId?: string | null;
}): ImageResultPresentation;
/**
 * Clamps prompts so they always fit within a single embed field. This keeps the
 * presentation compact while ensuring reboot recovery keeps working because the
 * embed never spills into continuation fields that might get pruned.
 */
export declare function clampPromptForContext(rawPrompt: string): string;
export declare function formatRetryCountdown(seconds: number): string;
/**
 * Converts snake_case choices returned by the planner or stored in context
 * into a human-friendly string for logs and user-facing content.
 */
export declare function toTitleCase(value: string): string;
export declare function formatStylePreset(value: ImageStylePreset): string;
/**
 * Creates the reusable "Generate variation" button row used by both slash
 * command responses and automated message flows.
 */
export declare function createVariationButtonRow(responseId: string): ActionRowBuilder<ButtonBuilder>;
/**
 * Creates a "Retry image generation" button row with a countdown label.
 */
export declare function createRetryButtonRow(retryKey: string, countdown: string): ActionRowBuilder<ButtonBuilder>;
/**
 * Converts the raw image buffer into an AttachmentBuilder for interaction-based
 * flows that expect Discord.js attachment instances.
 */
export declare function createImageAttachment(artifacts: ImageGenerationArtifacts): AttachmentBuilder;
export type { ImageGenerationContext };
