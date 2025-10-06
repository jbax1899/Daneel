import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    RepliableInteraction,
    SlashCommandBuilder
} from 'discord.js';
import { Command } from './BaseCommand.js';
import { logger } from '../utils/logger.js';
import { imageCommandRateLimiter } from '../utils/RateLimiter.js';
import { formatUsd } from '../utils/pricing.js';
import {
    setEmbedDescription,
    setEmbedFooterText,
    setOrAddEmbedField,
    truncateForEmbed
} from './image/embed.js';
import {
    DEFAULT_MODEL,
    EMBED_TITLE_LIMIT,
    PARTIAL_IMAGE_LIMIT,
    PROMPT_DISPLAY_LIMIT,
    REFLECTION_MESSAGE_LIMIT
} from './image/constants.js';
import {
    createImageAttachment,
    createVariationButtonRow,
    executeImageGeneration,
    toTitleCase
} from './image/sessionHelpers.js';
import { resolveImageCommandError } from './image/errors.js';
import type {
    ImageBackgroundType,
    ImageQualityType,
    ImageResponseModel,
    ImageSizeType,
    ImageStylePreset
} from './image/types.js';
import {
    evictFollowUpContext,
    saveFollowUpContext,
    type ImageGenerationContext
} from './image/followUpCache.js';

/**
 * Ensures that the interaction has been deferred before we begin streaming
 * updates to the reply.
 */
const ensureDeferredReply = async (interaction: RepliableInteraction): Promise<void> => {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }
};

export interface ImageGenerationSessionResult {
    success: boolean;
    responseId: string | null;
}

/**
 * Runs the end-to-end image generation flow and updates the interaction with
 * progress, results, and a follow-up button when successful.
 */
export async function runImageGenerationSession(
    interaction: RepliableInteraction,
    context: ImageGenerationContext,
    followUpResponseId?: string | null
): Promise<ImageGenerationSessionResult> {
    await ensureDeferredReply(interaction);

    const start = Date.now();
    const {
        prompt,
        model,
        size,
        aspectRatioLabel,
        quality,
        qualityRestricted,
        background,
        style,
        allowPromptAdjustment
    } = context;

    logger.debug(`Starting image generation session for user ${interaction.user.id} with model ${model}.`);

    const sizeFieldValue = size !== 'auto'
        ? `${aspectRatioLabel} (${size})`
        : aspectRatioLabel;

    const embed = new EmbedBuilder()
        .setTitle('🎨 Image Generation')
        .setColor(0x5865F2)
        .setTimestamp()
        .setDescription(truncateForEmbed(prompt, PROMPT_DISPLAY_LIMIT))
        .setFooter({ text: 'Generating…' })
        .addFields([
            {
                name: 'Size',
                value: sizeFieldValue,
                inline: true
            },
            {
                name: 'Quality',
                value: qualityRestricted ? `${toTitleCase(quality)} (Restricted)` : toTitleCase(quality),
                inline: true
            },
            {
                name: 'Input ID',
                value: followUpResponseId ? `\`${followUpResponseId}\`` : 'None',
                inline: true
            },
            {
                name: 'Style',
                value: toTitleCase(style),
                inline: true
            },
            {
                name: 'Background',
                value: toTitleCase(background),
                inline: true
            },
            {
                name: 'Output ID',
                value: '…',
                inline: true
            }
        ]);

    await interaction.editReply({ embeds: [embed], components: [], files: [] });

    let editChain: Promise<void> = Promise.resolve();

    const queueEmbedUpdate = (task: () => Promise<void>): Promise<void> => {
        editChain = editChain.then(async () => {
            try {
                await task();
            } catch (error) {
                logger.warn('Failed to update image preview embed:', error);
            }
        });

        return editChain;
    };

    try {
        const artifacts = await executeImageGeneration(context, {
            followUpResponseId,
            user: {
                username: interaction.user.username,
                nickname: interaction.member?.nickname ?? interaction.user.displayName ?? interaction.user.username,
                guildName: interaction.guild?.name ?? `No guild for ${interaction.type} interaction`
            },
            onPartialImage: payload => queueEmbedUpdate(async () => {
                const previewName = `image-preview-${payload.index + 1}.png`;
                const attachment = new AttachmentBuilder(Buffer.from(payload.base64, 'base64'), { name: previewName });
                setEmbedFooterText(embed, `Rendering preview ${payload.index + 1}/${PARTIAL_IMAGE_LIMIT}…`);
                embed.setThumbnail(`attachment://${previewName}`);
                await interaction.editReply({ embeds: [embed], files: [attachment] });
            })
        });

        await editChain;

        logger.debug(
            `Image generation usage - inputTokens: ${artifacts.usage.inputTokens}, outputTokens: ${artifacts.usage.outputTokens}, images: ${artifacts.usage.imageCount}, estimatedCost: ${formatUsd(artifacts.costs.total)}`
        );

        const outputResponseIdField = embed.data.fields?.find(field => field.name === 'Output ID');
        if (outputResponseIdField) {
            setOrAddEmbedField(embed, 'Output ID', artifacts.responseId ? `\`${artifacts.responseId}\`` : 'n/a', { inline: true });
        }

        const progressIndex = embed.data.fields?.findIndex(field => field.name === 'Progress') ?? -1;
        if (progressIndex >= 0) {
            embed.spliceFields(progressIndex, 1);
        }

        const embedTitle = artifacts.reflection.title ? `🎨 ${artifacts.reflection.title}` : '🎨 Image Generation';
        embed.setTitle(truncateForEmbed(embedTitle, EMBED_TITLE_LIMIT));

        if (artifacts.reflection.description) {
            setEmbedDescription(embed, artifacts.reflection.description);
        }

        if (artifacts.imageUrl) {
            embed.setImage(artifacts.imageUrl);
        }

        const attachment = artifacts.imageUrl ? null : createImageAttachment(artifacts);

        if (!artifacts.imageUrl && attachment) {
            embed.setImage(`attachment://${attachment.name}`);
        }

        const descriptionParts = [
            `**Prompt:** ${truncateForEmbed(prompt, PROMPT_DISPLAY_LIMIT)}`,
            allowPromptAdjustment
                ? `**Adjusted (${model}):** ${truncateForEmbed(artifacts.revisedPrompt ?? 'Model reused the original prompt.', PROMPT_DISPLAY_LIMIT)}`
                : '*Prompt adjustment disabled.*'
        ];
        embed.setDescription(descriptionParts.join('\n'));

        setOrAddEmbedField(embed, 'Style', toTitleCase(artifacts.finalStyle), { inline: true });

        const generationTimeInSeconds = artifacts.generationTimeMs / 1000;
        const generationTime = generationTimeInSeconds >= 60
            ? `${(generationTimeInSeconds / 60).toFixed(1)}m`
            : `${generationTimeInSeconds.toFixed(0)}s`;
        const imgPercent = parseInt(((artifacts.costs.image / artifacts.costs.total) * 100).toFixed(0));
        const txtPercent = parseInt((100 - imgPercent).toFixed(0));
        setEmbedFooterText(
            embed,
            `⏱️ ${generationTime} • ${formatUsd(artifacts.costs.total, 4)} • 🖼️${imgPercent}% 📝${txtPercent}%`
        );

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        if (artifacts.responseId) {
            saveFollowUpContext(artifacts.responseId, context);
            if (followUpResponseId && followUpResponseId !== artifacts.responseId) {
                evictFollowUpContext(followUpResponseId);
            }

            components.push(createVariationButtonRow(artifacts.responseId));
        }

        await interaction.editReply({
            content: artifacts.reflectionMessage.trim() || undefined,
            embeds: [embed],
            files: attachment ? [attachment] : [],
            components
        });

        return { success: true, responseId: artifacts.responseId };
    } catch (error) {
        await editChain;
        logger.error('Error in image generation session:', error);

        const errorMessage = resolveImageCommandError(error);
        try {
            await interaction.editReply({ content: `⚠️ ${errorMessage}`, embeds: [], files: [], components: [] });
        } catch (replyError) {
            logger.error('Failed to edit reply after image command error:', replyError);
            try {
                await interaction.followUp({ content: `⚠️ ${errorMessage}`, flags: [1 << 6], components: [] });
            } catch (followUpError) {
                logger.error('Failed to send follow-up after image command error:', followUpError);
            }
        }

        return { success: false, responseId: null };
    }
}

type AspectRatioOption = 'square' | 'portrait' | 'landscape';

const imageCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Generate an image based on the prompt provided')
        .addStringOption(option => option
            .setName('prompt')
            .setDescription('The prompt to generate the image from')
            .setRequired(true)
        )
        .addBooleanOption(option => option
            .setName('adjust_prompt')
            .setDescription('Allow the AI to adjust the prompt prior to generation (defaults to true)')
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('aspect_ratio')
            .setDescription('The aspect ratio to use (optional; defaults to auto)')
            .addChoices(
                { name: 'Square', value: 'square' },
                { name: 'Portrait', value: 'portrait' },
                { name: 'Landscape', value: 'landscape' }
            )
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('quality')
            .setDescription('Image quality (optional; defaults to low)')
            .addChoices(
                { name: 'Low', value: 'low' },
                { name: 'Medium', value: 'medium' },
                { name: 'High', value: 'high' }
            )
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('style')
            .setDescription('Image style preset (optional; defaults to unspecified)')
            .addChoices(
                { name: 'Natural', value: 'natural' },
                { name: 'Vivid', value: 'vivid' },
                { name: 'Photorealistic', value: 'photorealistic' },
                { name: 'Cinematic', value: 'cinematic' },
                { name: 'Oil Painting', value: 'oil_painting' },
                { name: 'Watercolor', value: 'watercolor' },
                { name: 'Digital Painting', value: 'digital_painting' },
                { name: 'Line Art', value: 'line_art' },
                { name: 'Sketch', value: 'sketch' },
                { name: 'Cartoon', value: 'cartoon' },
                { name: 'Anime', value: 'anime' },
                { name: 'Comic Book', value: 'comic' },
                { name: 'Pixel Art', value: 'pixel_art' },
                { name: 'Cyberpunk', value: 'cyberpunk' },
                { name: 'Fantasy Art', value: 'fantasy_art' },
                { name: 'Surrealist', value: 'surrealist' },
                { name: 'Minimalist', value: 'minimalist' },
                { name: 'Vintage', value: 'vintage' },
                { name: 'Noir', value: 'noir' },
                { name: '3D Render', value: '3d_render' },
                { name: 'Steampunk', value: 'steampunk' },
                { name: 'Abstract', value: 'abstract' },
                { name: 'Pop Art', value: 'pop_art' },
                { name: 'Dreamcore', value: 'dreamcore' },
                { name: 'Isometric', value: 'isometric' }
            )
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('background')
            .setDescription('Image background (optional; defaults to auto)')
            .addChoices(
                { name: 'Auto', value: 'auto' },
                { name: 'Transparent', value: 'transparent' },
                { name: 'Opaque', value: 'opaque' }
            )
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('model')
            .setDescription(`The model to use for prompt adjustment (optional; defaults to ${DEFAULT_MODEL})`)
            .addChoices(
                { name: 'gpt-4.1', value: 'gpt-4.1' },
                { name: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
                { name: 'gpt-4.1-nano', value: 'gpt-4.1-nano' },
                { name: 'gpt-4o', value: 'gpt-4o' },
                { name: 'gpt-4o-mini', value: 'gpt-4o-mini' }
            )
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('follow_up_response_id')
            .setDescription('Response ID from a previous image generation for follow-up (optional)')
            .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (interaction.user.id !== process.env.DEVELOPER_USER_ID) {
            const { allowed, retryAfter, error } = imageCommandRateLimiter.checkRateLimitImageCommand(interaction.user.id);
            if (!allowed) {
                const seconds = retryAfter ?? 0;
                const minutes = Math.floor(seconds / 60);
                await interaction.reply({ content: `⚠️ ${error} Try again in ${minutes}m${seconds % 60}s`, flags: [1 << 6] });
                return;
            }
        }

        const prompt = interaction.options.getString('prompt');
        if (!prompt) {
            await interaction.reply({
                content: '⚠️ No prompt provided.',
                flags: [1 << 6]
            });
            return;
        }
        logger.debug(`Received image generation request with prompt: ${prompt}`);

        const aspectRatioOption = interaction.options.getString('aspect_ratio') as AspectRatioOption | null;
        let size: ImageSizeType = 'auto';
        let aspectRatio: ImageGenerationContext['aspectRatio'] = 'auto';
        let aspectRatioLabel = 'Auto';

        if (aspectRatioOption) {
            aspectRatio = aspectRatioOption;
            switch (aspectRatioOption) {
                case 'square':
                    size = '1024x1024';
                    aspectRatioLabel = 'Square';
                    break;
                case 'portrait':
                    size = '1024x1536';
                    aspectRatioLabel = 'Portrait';
                    break;
                case 'landscape':
                    size = '1536x1024';
                    aspectRatioLabel = 'Landscape';
                    break;
            }
        }

        const isSuperUser = interaction.user.id === process.env.DEVELOPER_USER_ID;
        const requestedQuality = interaction.options.getString('quality') as ImageQualityType | null;
        let quality: ImageQualityType = requestedQuality ?? 'low';
        let qualityRestricted = false;
        if ((quality === 'medium' || quality === 'high') && !isSuperUser) {
            quality = 'low';
            qualityRestricted = true;
            logger.warn(`User ${interaction.user.id} attempted to use restricted quality setting '${requestedQuality}'. Falling back to 'low'.`);
        }

        const model = (interaction.options.getString('model') as ImageResponseModel | null) ?? DEFAULT_MODEL;
        const background = (interaction.options.getString('background') as ImageBackgroundType | null) ?? 'auto';
        const style = (interaction.options.getString('style') as ImageStylePreset | null) ?? 'unspecified';
        const adjustPrompt = interaction.options.getBoolean('adjust_prompt') ?? true;
        let followUpResponseId = interaction.options.getString('follow_up_response_id');

        if (followUpResponseId && !followUpResponseId.startsWith('resp_')) {
            followUpResponseId = `resp_${followUpResponseId}`;
            logger.warn(`Follow-up response ID was not prefixed with 'resp_'. Adding prefix: ${followUpResponseId}`);
        }

        const context: ImageGenerationContext = {
            prompt,
            model,
            size,
            aspectRatio,
            aspectRatioLabel,
            quality,
            qualityRestricted,
            background,
            style,
            allowPromptAdjustment: adjustPrompt,
            authorUserId: interaction.user.id,
            authorGuildId: interaction.guild?.id ?? null
        };

        await runImageGenerationSession(interaction, context, followUpResponseId ?? undefined);
    }
};

export default imageCommand;
