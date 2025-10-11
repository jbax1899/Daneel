import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { OpenAI } from 'openai';
import { logger } from '../../utils/logger.js';
import { estimateImageGenerationCost, estimateTextCost, formatUsd } from '../../utils/pricing.js';
import { EMBED_FIELD_VALUE_LIMIT, EMBED_MAX_FIELDS, EMBED_TOTAL_FIELD_CHAR_LIMIT, EMBED_TITLE_LIMIT, IMAGE_RETRY_CUSTOM_ID_PREFIX, IMAGE_VARIATION_CUSTOM_ID_PREFIX, REFLECTION_MESSAGE_LIMIT } from './constants.js';
import { isCloudinaryConfigured, uploadToCloudinary } from './cloudinary.js';
import { generateImageWithReflection } from './openai.js';
import { sanitizeForEmbed, setEmbedDescription, setEmbedFooterText, truncateForEmbed } from './embed.js';
/**
 * Runs the OpenAI image pipeline, uploads the final asset, and returns a
 * normalized payload describing the generation. The caller is responsible for
 * presenting the result (embed, plain message, etc.) and for caching follow-up
 * context entries.
 */
export async function executeImageGeneration(context, options) {
    const start = Date.now();
    const openai = new OpenAI();
    const generation = await generateImageWithReflection({
        openai,
        prompt: context.prompt,
        textModel: context.textModel,
        imageModel: context.imageModel,
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
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const totalTokens = response.usage?.total_tokens ?? (inputTokens + outputTokens);
    const imageCallOutputs = response.output.filter((output) => output.type === 'image_generation_call' && Boolean(output.result));
    const successfulImageCount = imageCallOutputs.length || 1;
    const finalStyle = imageCall.style_preset ?? context.style;
    const textCostEstimate = estimateTextCost(context.textModel, inputTokens, outputTokens);
    const imageCostEstimate = estimateImageGenerationCost({
        quality: context.quality,
        size: context.size,
        imageCount: successfulImageCount,
        model: context.imageModel
    });
    const totalCost = textCostEstimate.totalCost + imageCostEstimate.totalCost;
    const finalImageBuffer = Buffer.from(finalImageBase64, 'base64');
    const finalImageFileName = `daneel-image-${Date.now()}.png`;
    let imageUrl = null;
    if (isCloudinaryConfigured) {
        try {
            imageUrl = await uploadToCloudinary(finalImageBuffer, {
                originalPrompt: context.originalPrompt ?? context.prompt,
                revisedPrompt: reflection.adjustedPrompt ?? imageCall.revised_prompt ?? null,
                title: reflection.title,
                description: reflection.description,
                reflectionMessage: reflection.reflection,
                textModel: context.textModel,
                imageModel: context.imageModel,
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
        }
        catch (error) {
            logger.error('Error uploading to Cloudinary:', error);
        }
    }
    else {
        logger.warn('Cloudinary credentials missing; using local attachment for image delivery.');
    }
    const generationTimeMs = Date.now() - start;
    const revisedPrompt = reflection.adjustedPrompt ?? imageCall.revised_prompt ?? null;
    const reflectionMessage = reflection.reflection
        ? truncateForEmbed(reflection.reflection, REFLECTION_MESSAGE_LIMIT, { includeTruncationNote: true })
        : '';
    return {
        responseId: response.id ?? null,
        textModel: context.textModel,
        imageModel: context.imageModel,
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
 * Builds the embed, attachments, and follow-up controls that should be sent
 * when an image generation task finishes. The resulting embed always embeds
 * machine-readable fields (model, prompt sections, etc.) to make reboot
 * recovery possible via Discord's native message history.
 */
export function buildImageResultPresentation(context, artifacts, { followUpResponseId } = {}) {
    const originalPrompt = context.originalPrompt ?? context.prompt;
    const candidateRefinedPrompt = artifacts.revisedPrompt ?? context.refinedPrompt ?? null;
    const refinedPrompt = candidateRefinedPrompt && candidateRefinedPrompt !== originalPrompt
        ? candidateRefinedPrompt
        : null;
    const activePrompt = refinedPrompt ?? context.prompt;
    const normalizedOriginalPrompt = clampPromptForContext(originalPrompt);
    const normalizedRefinedCandidate = refinedPrompt ? clampPromptForContext(refinedPrompt) : null;
    const normalizedActivePrompt = clampPromptForContext(activePrompt);
    const normalizedRefinedPrompt = normalizedRefinedCandidate && normalizedRefinedCandidate !== normalizedOriginalPrompt
        ? normalizedRefinedCandidate
        : null;
    const followUpContext = {
        ...context,
        textModel: artifacts.textModel,
        imageModel: artifacts.imageModel,
        prompt: normalizedActivePrompt,
        originalPrompt: normalizedOriginalPrompt,
        refinedPrompt: normalizedRefinedPrompt,
        style: artifacts.finalStyle,
        allowPromptAdjustment: context.allowPromptAdjustment ?? true
    };
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTimestamp();
    const title = artifacts.reflection.title ? `🎨 ${artifacts.reflection.title}` : '🎨 Image Generation';
    embed.setTitle(truncateForEmbed(title, EMBED_TITLE_LIMIT));
    if (artifacts.reflection.description) {
        setEmbedDescription(embed, artifacts.reflection.description);
    }
    if (artifacts.imageUrl) {
        embed.setImage(artifacts.imageUrl);
    }
    // We build the field list manually so we can enforce Discord's 25-field and
    // 6,000-character limits. Exceeding these limits causes message edits to
    // fail, which would strand users without a usable follow-up button.
    const fields = [];
    let fieldCharacterBudget = 0;
    let metadataTruncated = false;
    const tryAddField = (name, rawValue, options = {}) => {
        const formattedValue = truncateForEmbed(rawValue, options.maxLength ?? EMBED_FIELD_VALUE_LIMIT, {
            includeTruncationNote: options.includeTruncationNote ?? false
        });
        const charCost = name.length + formattedValue.length;
        if (fields.length >= EMBED_MAX_FIELDS || fieldCharacterBudget + charCost > EMBED_TOTAL_FIELD_CHAR_LIMIT) {
            return false;
        }
        fields.push({ name, value: formattedValue, inline: options.inline ?? false });
        fieldCharacterBudget += charCost;
        return true;
    };
    const assertField = (name, value, options, { trackAsMetadata = true } = {}) => {
        if (!tryAddField(name, value, options)) {
            if (trackAsMetadata) {
                metadataTruncated = true;
            }
            logger.warn(`Image embed field "${name}" could not be added due to Discord limits.`);
        }
    };
    const recordPrompt = (label, value) => {
        if (!value) {
            return false;
        }
        const sanitized = sanitizeForEmbed(value);
        const truncated = sanitized.length > EMBED_FIELD_VALUE_LIMIT;
        assertField(label, sanitized, { includeTruncationNote: truncated });
        return truncated;
    };
    const currentTruncated = recordPrompt('Current prompt', normalizedActivePrompt);
    const originalTruncated = recordPrompt('Original prompt', normalizedOriginalPrompt);
    assertField('Image model', followUpContext.imageModel, { inline: true });
    assertField('Text model', followUpContext.textModel, { inline: true });
    assertField('Quality', `${toTitleCase(followUpContext.quality)} (${followUpContext.imageModel})`, { inline: true });
    assertField('Aspect ratio', followUpContext.aspectRatioLabel, { inline: true });
    assertField('Resolution', followUpContext.size === 'auto' ? 'Auto' : followUpContext.size, { inline: true });
    assertField('Background', toTitleCase(followUpContext.background), { inline: true });
    assertField('Prompt adjustment', followUpContext.allowPromptAdjustment ? 'Enabled' : 'Disabled', { inline: true });
    assertField('Style', formatStylePreset(followUpContext.style), { inline: true });
    if (followUpResponseId) {
        assertField('Input ID', `\`${followUpResponseId}\``, { inline: true });
    }
    assertField('Output ID', artifacts.responseId ? `\`${artifacts.responseId}\`` : 'n/a', { inline: true });
    const refinedTruncated = normalizedRefinedPrompt ? currentTruncated : false;
    const activeTruncated = currentTruncated;
    embed.addFields(fields);
    const generationSeconds = Math.max(1, Math.round(artifacts.generationTimeMs / 1000));
    const minutes = Math.floor(generationSeconds / 60);
    const seconds = generationSeconds % 60;
    const formattedDuration = minutes > 0
        ? `${minutes}m${seconds.toString().padStart(2, '0')}s`
        : `${seconds}s`;
    const { imagePercent, textPercent } = calculateCostPercentages(artifacts.costs.image, artifacts.costs.text);
    const footerParts = [
        `⏱️ ${formattedDuration}`,
        `💰${formatCostForFooter(artifacts.costs.total)}`,
        `🖼️${imagePercent}%`,
        `📝${textPercent}%`
    ];
    if (originalTruncated || refinedTruncated || activeTruncated) {
        footerParts.push('Prompt truncated');
    }
    if (metadataTruncated) {
        footerParts.push('Metadata truncated');
    }
    setEmbedFooterText(embed, footerParts.join(' • '));
    const attachments = [];
    if (!artifacts.imageUrl) {
        attachments.push(createImageAttachment(artifacts));
    }
    const components = artifacts.responseId ? [createVariationButtonRow(artifacts.responseId)] : [];
    return {
        content: artifacts.reflectionMessage.trim() || undefined,
        embed,
        attachments,
        components,
        followUpContext
    };
}
/**
 * Clamps prompts so they always fit within a single embed field. This keeps the
 * presentation compact while ensuring reboot recovery keeps working because the
 * embed never spills into continuation fields that might get pruned.
 */
export function clampPromptForContext(rawPrompt) {
    const sanitized = sanitizeForEmbed(rawPrompt).trim();
    if (sanitized.length <= EMBED_FIELD_VALUE_LIMIT) {
        return sanitized;
    }
    logger.warn(`Prompt exceeded embed field limit; truncating to ${EMBED_FIELD_VALUE_LIMIT} characters to preserve layout.`);
    return sanitized.slice(0, EMBED_FIELD_VALUE_LIMIT);
}
/**
 * Formats a short human-readable countdown string (e.g., "2m30s") for rate
 * limit messaging and button labels.
 */
function formatCostForFooter(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return '0¢';
    }
    if (amount < 1) {
        const tenthsOfCent = Math.max(0, Math.round(amount * 1000));
        return `${(tenthsOfCent / 10).toFixed(1)}¢`;
    }
    return formatUsd(amount, 2);
}
/**
 * Converts the raw image/text cost components into rounded percentages that
 * always add up to 100. This keeps the footer lightweight while still giving
 * users an intuitive sense of where their credits were spent.
 */
function calculateCostPercentages(imageCost, textCost) {
    const safeImageCost = Number.isFinite(imageCost) && imageCost > 0 ? imageCost : 0;
    const safeTextCost = Number.isFinite(textCost) && textCost > 0 ? textCost : 0;
    const combined = safeImageCost + safeTextCost;
    if (combined <= 0) {
        return { imagePercent: 100, textPercent: 0 };
    }
    const rawImageShare = safeImageCost / combined * 100;
    let imagePercent = Math.round(rawImageShare);
    imagePercent = Math.min(100, Math.max(0, imagePercent));
    let textPercent = 100 - imagePercent;
    if (textPercent < 0) {
        textPercent = 0;
        imagePercent = 100;
    }
    return { imagePercent, textPercent };
}
export function formatRetryCountdown(seconds) {
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
export function toTitleCase(value) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
export function formatStylePreset(value) {
    if (!value || value === 'unspecified') {
        return 'Auto';
    }
    return toTitleCase(value);
}
/**
 * Creates the reusable "Generate variation" button row used by both slash
 * command responses and automated message flows.
 */
export function createVariationButtonRow(responseId) {
    const button = new ButtonBuilder()
        .setCustomId(`${IMAGE_VARIATION_CUSTOM_ID_PREFIX}${responseId}`)
        .setLabel('Generate variation')
        .setStyle(ButtonStyle.Secondary);
    return new ActionRowBuilder().addComponents(button);
}
/**
 * Creates a "Retry image generation" button row with a countdown label.
 */
export function createRetryButtonRow(retryKey, countdown) {
    const button = new ButtonBuilder()
        .setCustomId(`${IMAGE_RETRY_CUSTOM_ID_PREFIX}${retryKey}`)
        .setLabel(`Retry image generation (${countdown})`)
        .setStyle(ButtonStyle.Secondary);
    return new ActionRowBuilder().addComponents(button);
}
/**
 * Converts the raw image buffer into an AttachmentBuilder for interaction-based
 * flows that expect Discord.js attachment instances.
 */
export function createImageAttachment(artifacts) {
    return new AttachmentBuilder(artifacts.finalImageBuffer, { name: artifacts.finalImageFileName });
}
//# sourceMappingURL=sessionHelpers.js.map