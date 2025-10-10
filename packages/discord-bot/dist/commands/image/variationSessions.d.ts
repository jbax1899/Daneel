import { ActionRowBuilder, EmbedBuilder, ModalBuilder, type InteractionUpdateOptions, type MessageActionRowComponentBuilder } from 'discord.js';
import type { ImageGenerationContext } from './followUpCache.js';
import type { ImageBackgroundType, ImageQualityType, ImageRenderModel, ImageSizeType, ImageStylePreset, ImageTextModel } from './types.js';
/**
 * Represents the per-user configuration state for a variation session. We keep
 * this information in memory while the user is interacting with the ephemeral
 * configurator so that select/menu events can update the preview without
 * losing the in-progress choices.
 */
export interface VariationSessionState {
    key: string;
    userId: string;
    responseId: string;
    prompt: string;
    originalPrompt: string;
    refinedPrompt: string | null;
    textModel: ImageTextModel;
    imageModel: ImageRenderModel;
    size: ImageSizeType;
    aspectRatio: ImageGenerationContext['aspectRatio'];
    aspectRatioLabel: string;
    quality: ImageQualityType;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    allowPromptAdjustment: boolean;
    timeout: NodeJS.Timeout;
    cooldownUntil: number | null;
    cooldownTimer?: NodeJS.Timeout;
    messageUpdater?: (options: InteractionUpdateOptions) => Promise<unknown>;
    statusMessage: string | null;
}
type VariationConfiguratorView = {
    content?: string;
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
};
export declare function initialiseVariationSession(userId: string, responseId: string, context: ImageGenerationContext): VariationSessionState;
export declare function getVariationSession(userId: string, responseId: string): VariationSessionState | null;
export declare function updateVariationSession(userId: string, responseId: string, updater: (session: VariationSessionState) => void): VariationSessionState | null;
export declare function setVariationSessionUpdater(userId: string, responseId: string, updater: (options: InteractionUpdateOptions) => Promise<unknown>): VariationSessionState | null;
export declare function disposeVariationSession(key: string): void;
export declare function applyVariationCooldown(userId: string, responseId: string, seconds: number): VariationSessionState | null;
export declare function resetVariationCooldown(userId: string, responseId: string): VariationSessionState | null;
export declare function buildVariationConfiguratorView(session: VariationSessionState, options?: {
    statusMessage?: string;
}): VariationConfiguratorView;
export declare function buildPromptModal(responseId: string, currentPrompt: string): ModalBuilder;
export {};
