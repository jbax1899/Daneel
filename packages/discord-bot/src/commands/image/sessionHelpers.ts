import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { OpenAI } from 'openai';
import { logger } from '../../utils/logger.js';
import {
    estimateImageGenerationCost,
    estimateTextCost,
    formatUsd,
    type TextModelPricingKey
} from '../../utils/pricing.js';
import {
    EMBED_TITLE_LIMIT,
    IMAGE_RETRY_CUSTOM_ID_PREFIX,
    IMAGE_VARIATION_CUSTOM_ID_PREFIX,
    PROMPT_DISPLAY_LIMIT,
    REFLECTION_DESCRIPTION_LIMIT,
    REFLECTION_MESSAGE_LIMIT
} from './constants.js';
import { isCloudinaryConfigured, uploadToCloudinary } from './cloudinary.js';
import { generateImageWithReflection } from './openai.js';
import type { ImageGenerationCallWithPrompt, ImageStylePreset, PartialImagePayload, ReflectionFields } from './types.js';
import type { ImageGenerationContext } from './followUpCache.js';
import { truncateForEmbed } from './embed.js';

/**
 * Provides structured metadata about a generated image so that different
 * presentation layers (slash commands, automated responses, button retries)
 * can render consistent messages without duplicating the cost/upload logic.
 */
export interface ImageGenerationArtifacts {
    responseId: string | null;
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
export async function executeImageGeneration(
    context: ImageGenerationContext,
    options: ExecuteImageGenerationOptions
): Promise<ImageGenerationArtifacts> {
    const start = Date.now();
    const openai = new OpenAI();

    const generation = await generateImageWithReflection({
        openai,
        prompt: context.prompt,
        model: context.model,
        quality: context.quality,
        size: context.size,
        background: context.background,
        style: context.style,
        allowPromptAdjustment: context.allowPromptAdjustment,
        followUpResponseId: options.followUpResponseId,
        username: options.user.username,
        nickname: options.user.nickname,
        guildName: options.user.guildName,
        onPartialImage: options.onPartialImage
    });

    const { response, imageCall, finalImageBase64, reflection } = generation;
    const usage = response.usage ?? {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

    const imageCallOutputs = response.output.filter(
        (output): output is ImageGenerationCallWithPrompt => output.type === 'image_generation_call' && Boolean(output.result)
    );
    const successfulImageCount = imageCallOutputs.length || 1;
    const finalStyle = imageCall.style_preset ?? context.style;

    const textCostEstimate = estimateTextCost(
        context.model as TextModelPricingKey,
        inputTokens,
        outputTokens
    );
    const imageCostEstimate = estimateImageGenerationCost({
        quality: context.quality,
        size: context.size,
        imageCount: successfulImageCount
    });
    const totalCost = textCostEstimate.totalCost + imageCostEstimate.totalCost;

    const finalImageBuffer = Buffer.from(finalImageBase64, 'base64');
    const finalImageFileName = `daneel-image-${Date.now()}.png`;
    let imageUrl: string | null = null;

    if (isCloudinaryConfigured) {
        try {
            imageUrl = await uploadToCloudinary(finalImageBuffer, {
                originalPrompt: context.prompt,
                revisedPrompt: reflection.adjustedPrompt ?? imageCall.revised_prompt ?? null,
                title: reflection.title,
                description: reflection.description,
                reflectionMessage: reflection.reflection,
                model: context.model,
                quality: context.quality,
                size: context.size,
                background: context.background,
                style: finalStyle,
                startTime: start,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    imageCount: successfulImageCount,
                    combinedInputTokens: inputTokens,
                    combinedOutputTokens: outputTokens,
                    combinedTotalTokens: totalTokens
                },
                cost: {
                    text: textCostEstimate.totalCost,
                    image: imageCostEstimate.totalCost,
                    total: totalCost,
                    perImage: imageCostEstimate.perImageCost
                }
            });
        } catch (error) {
            logger.error('Error uploading to Cloudinary:', error);
        }
    } else {
        logger.warn('Cloudinary credentials missing; using local attachment for image delivery.');
    }

    const generationTimeMs = Date.now() - start;
    const revisedPrompt = reflection.adjustedPrompt ?? imageCall.revised_prompt ?? null;
    const reflectionMessage = reflection.reflection
        ? truncateForEmbed(reflection.reflection, REFLECTION_MESSAGE_LIMIT, { includeTruncationNote: true })
        : '';

    return {
        responseId: response.id ?? null,
        revisedPrompt,
        finalStyle,
        reflection,
        reflectionMessage,
        finalImageBuffer,
        finalImageFileName,
        imageUrl,
        usage: {
            inputTokens,
            outputTokens,
            totalTokens,
            imageCount: successfulImageCount
        },
        costs: {
            text: textCostEstimate.totalCost,
            image: imageCostEstimate.totalCost,
            total: totalCost,
            perImage: imageCostEstimate.perImageCost
        },
        generationTimeMs
    };
}

/**
 * Formats a short human-readable countdown string (e.g., "2m30s") for rate
 * limit messaging and button labels.
 */
export function formatRetryCountdown(seconds: number): string {
    if (seconds <= 0) {
        return 'now';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0 && remainingSeconds > 0) {
        return `${minutes}m${remainingSeconds}s`;
    }

    if (minutes > 0) {
        return `${minutes}m`;
    }

    return `${remainingSeconds}s`;
}

/**
 * Converts snake_case choices returned by the planner or stored in context
 * into a human-friendly string for logs and user-facing content.
 */
export function toTitleCase(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Creates the reusable "Generate variation" button row used by both slash
 * command responses and automated message flows.
 */
export function createVariationButtonRow(responseId: string): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
        .setCustomId(`${IMAGE_VARIATION_CUSTOM_ID_PREFIX}${responseId}`)
        .setLabel('Generate variation')
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

/**
 * Creates a "Retry image generation" button row with a countdown label.
 */
export function createRetryButtonRow(retryKey: string, countdown: string): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
        .setCustomId(`${IMAGE_RETRY_CUSTOM_ID_PREFIX}${retryKey}`)
        .setLabel(`Retry image generation (${countdown})`)
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

/**
 * Builds the plain-text content that accompanies automated image messages so
 * that those responses share the same structure across initial runs and
 * button-triggered retries.
 */
export function buildImageResponseContent(
    context: ImageGenerationContext,
    artifacts: ImageGenerationArtifacts
): string {
    const lines: string[] = [];

    if (artifacts.reflection.title) {
        lines.push(`**${truncateForEmbed(artifacts.reflection.title, EMBED_TITLE_LIMIT)}**`);
    }

    if (artifacts.reflection.description) {
        lines.push(truncateForEmbed(artifacts.reflection.description, REFLECTION_DESCRIPTION_LIMIT));
    }

    if (artifacts.reflectionMessage) {
        lines.push(artifacts.reflectionMessage);
    }

    lines.push('');
    lines.push(`Prompt: ${truncateForEmbed(context.prompt, PROMPT_DISPLAY_LIMIT)}`);

    if (context.allowPromptAdjustment) {
        lines.push(
            `Adjusted (${context.model}): ${truncateForEmbed(
                artifacts.revisedPrompt ?? 'Model reused the original prompt.',
                PROMPT_DISPLAY_LIMIT
            )}`
        );
    } else {
        lines.push('Prompt adjustment disabled.');
    }

    lines.push(`Style: ${toTitleCase(artifacts.finalStyle)}`);
    lines.push(`Quality: ${toTitleCase(context.quality)}`);

    const generationSeconds = Math.max(1, Math.round(artifacts.generationTimeMs / 1000));
    const minutes = Math.floor(generationSeconds / 60);
    const seconds = generationSeconds % 60;
    const formattedDuration = minutes > 0 ? `${minutes}m${seconds.toString().padStart(2, '0')}s` : `${seconds}s`;

    lines.push(`⏱️ ${formattedDuration} • ${formatUsd(artifacts.costs.total, 4)}`);

    if (artifacts.imageUrl) {
        lines.push(artifacts.imageUrl);
    }

    const message = lines.filter(Boolean).join('\n').trim();

    if (message.length <= 2000) {
        return message;
    }

    return `${message.slice(0, 1997)}…`;
}

/**
 * Converts the raw image buffer into an AttachmentBuilder for interaction-based
 * flows that expect Discord.js attachment instances.
 */
export function createImageAttachment(artifacts: ImageGenerationArtifacts): AttachmentBuilder {
    return new AttachmentBuilder(artifacts.finalImageBuffer, { name: artifacts.finalImageFileName });
}

export type { ImageGenerationContext };
