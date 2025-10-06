import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, RepliableInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from './BaseCommand.js';
import { logger } from '../utils/logger.js';
import { imageCommandRateLimiter } from '../utils/RateLimiter.js';
import { formatUsd } from '../utils/pricing.js';
import { setEmbedFooterText, truncateForEmbed } from './image/embed.js';
import { DEFAULT_MODEL, PARTIAL_IMAGE_LIMIT, PROMPT_DISPLAY_LIMIT } from './image/constants.js';
import { resolveAspectRatioSettings } from './image/aspect.js';
import { buildImageResultPresentation, executeImageGeneration, formatStylePreset, toTitleCase } from './image/sessionHelpers.js';
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

    const {
        prompt,
        model,
        size,
        aspectRatioLabel,
        quality,
        background,
        style
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
        .setFooter({ text: 'Generating…' });

    const statusFields = [
        {
            name: 'Size',
            value: sizeFieldValue,
            inline: true
        },
        {
            name: 'Quality',
            value: toTitleCase(quality),
            inline: true
        },
        {
            name: 'Style',
            value: formatStylePreset(style),
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
    ];

    if (followUpResponseId) {
        statusFields.splice(2, 0, {
            name: 'Input ID',
            value: `\`${followUpResponseId}\``,
            inline: true
        });
    }

    embed.addFields(statusFields);

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
        const rawMember = interaction.member;
        const resolvedNickname = typeof rawMember === 'object' && rawMember !== null
            ? ('nickname' in rawMember && rawMember.nickname)
                || ('nick' in rawMember && typeof rawMember.nick === 'string' ? rawMember.nick : null)
            : null;

        const artifacts = await executeImageGeneration(context, {
            followUpResponseId,
            user: {
                username: interaction.user.username,
                nickname: resolvedNickname ?? interaction.user.displayName ?? interaction.user.username,
                guildName: interaction.guild?.name ?? `No guild for ${interaction.type} interaction`
            },
            onPartialImage: payload => queueEmbedUpdate(async () => {
                const previewName = `image-preview-${payload.index + 1}.png`;
                const attachment = new AttachmentBuilder(Buffer.from(payload.base64, 'base64'), { name: previewName });
                setEmbedFooterText(embed, `Rendering preview ${payload.index + 1}/${PARTIAL_IMAGE_LIMIT}…`);
                embed.setThumbnail(`attachment://${previewName}`);
                // Always clear previous attachments so Discord does not retain a
                // growing list of previews on the interaction response.
                await interaction.editReply({ embeds: [embed], files: [attachment], attachments: [] });
            })
        });

        await editChain;

        logger.debug(
            `Image generation usage - inputTokens: ${artifacts.usage.inputTokens}, outputTokens: ${artifacts.usage.outputTokens}, images: ${artifacts.usage.imageCount}, estimatedCost: ${formatUsd(artifacts.costs.total)}`
        );

        const presentation = buildImageResultPresentation(context, artifacts, { followUpResponseId });

        if (artifacts.responseId) {
            saveFollowUpContext(artifacts.responseId, presentation.followUpContext);
            if (followUpResponseId && followUpResponseId !== artifacts.responseId) {
                evictFollowUpContext(followUpResponseId);
            }
        }

        await interaction.editReply({
            content: presentation.content,
            embeds: [presentation.embed],
            files: presentation.attachments,
            attachments: [],
            components: presentation.components
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

        const aspectRatioOption = interaction.options.getString('aspect_ratio') as ImageGenerationContext['aspectRatio'] | null;
        const { size, aspectRatio, aspectRatioLabel } = resolveAspectRatioSettings(aspectRatioOption);

        const isSuperUser = interaction.user.id === process.env.DEVELOPER_USER_ID;
        const requestedQuality = interaction.options.getString('quality') as ImageQualityType | null;
        let quality: ImageQualityType = requestedQuality ?? 'low';
        if ((quality === 'medium' || quality === 'high') && !isSuperUser) {
            quality = 'low';
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
            originalPrompt: prompt,
            refinedPrompt: null,
            model,
            size,
            aspectRatio,
            aspectRatioLabel,
            quality,
            background,
            style,
            allowPromptAdjustment: adjustPrompt
        };

        await runImageGenerationSession(interaction, context, followUpResponseId ?? undefined);
    }
};

export default imageCommand;
