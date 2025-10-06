import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder
} from 'discord.js';
import { Command } from './BaseCommand.js';
import { OpenAI } from 'openai';
import { logger } from '../utils/logger.js';
import { imageCommandRateLimiter } from '../utils/RateLimiter.js';
import {
    estimateImageGenerationCost,
    estimateTextCost,
    formatUsd,
    type TextModelPricingKey
} from '../utils/pricing.js';
import {
    buildPromptFieldValue,
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
    isCloudinaryConfigured,
    uploadToCloudinary
} from './image/cloudinary.js';
import { generateImageWithReflection } from './image/openai.js';
import { resolveImageCommandError } from './image/errors.js';
import type {
    ImageBackgroundType,
    ImageGenerationCallWithPrompt,
    ImageQualityType,
    ImageResponseModel,
    ImageSizeType,
    ImageStylePreset
} from './image/types.js';

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

        await interaction.deferReply();
        const start = Date.now();

        let dimensions: ImageSizeType = 'auto';
        const aspectRatio = interaction.options.getString('aspect_ratio') as ('square' | 'portrait' | 'landscape') | null;
        if (aspectRatio) {
            switch (aspectRatio) {
                case 'square':
                    dimensions = '1024x1024';
                    break;
                case 'portrait':
                    dimensions = '1024x1536';
                    break;
                case 'landscape':
                    dimensions = '1536x1024';
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
        const promptExceedsDisplayLimit = prompt.length > PROMPT_DISPLAY_LIMIT;

        if (followUpResponseId && !followUpResponseId.startsWith('resp_')) {
            followUpResponseId = `resp_${followUpResponseId}`;
            logger.warn(`Follow-up response ID was not prefixed with 'resp_'. Adding prefix: ${followUpResponseId}`);
        }

        const embed = new EmbedBuilder()
            .setTitle('🎨 Image Generation')
            .setColor(0x5865F2)
            .setTimestamp()
            .setDescription(truncateForEmbed(prompt, 500))
            .setFooter({ text: 'Generating…' })
            .addFields([
                {
                    name: 'Size',
                    value: dimensions !== 'auto' ? `${aspectRatio?.replace(/\b\w/g, l => l.toUpperCase()) ?? 'Custom'} (${dimensions})` : 'Auto',
                    inline: true
                },
                {
                    name: 'Quality',
                    value: qualityRestricted ? `${quality.replace(/\b\w/g, l => l.toUpperCase())} (Restricted)` : quality.replace(/\b\w/g, l => l.toUpperCase()),
                    inline: true
                },
                {
                    name: 'Input ID',
                    value: followUpResponseId ? `\`${followUpResponseId}\`` : 'None',
                    inline: true
                },
                {
                    name: 'Style',
                    value: style.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), // replacing _ with spaces, capitalize first letter(s)
                    inline: true
                },
                {
                    name: 'Background',
                    value: background.replace(/\b\w/g, l => l.toUpperCase()), // capitalize first letter
                    inline: true
                },
                {
                    name: 'Output ID',
                    value: '…',
                    inline: true
                }
            ]);
        

        await interaction.editReply({ embeds: [embed] });

        const openai = new OpenAI();
        let editChain = Promise.resolve();

        const queueEmbedUpdate = (task: () => Promise<void>) => {
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
            const generation = await generateImageWithReflection({
                openai,
                prompt,
                model,
                quality,
                size: dimensions,
                background,
                style,
                allowPromptAdjustment: adjustPrompt,
                followUpResponseId,
                username: interaction.user.username,
                nickname: interaction.user.displayName,
                guildName: interaction.guild?.name ?? `No guild for ${interaction.type} interaction`,
                onPartialImage: payload => queueEmbedUpdate(async () => {
                    const previewName = `image-preview-${payload.index + 1}.png`;
                    const attachment = new AttachmentBuilder(Buffer.from(payload.base64, 'base64'), { name: previewName });
                    setEmbedFooterText(embed, `Rendering preview ${payload.index + 1}/${PARTIAL_IMAGE_LIMIT}…`);
                    embed.setThumbnail(`attachment://${previewName}`); // Thumnail places a small image to the side while we wait for it to finish generating, rather than full-size image under
                    await interaction.editReply({ embeds: [embed], files: [attachment] });
                })
            });

            await editChain;

            const { response, imageCall, finalImageBase64, reflection } = generation;
            const usage = response.usage;
            const inputTokens = usage?.input_tokens ?? 0;
            const outputTokens = usage?.output_tokens ?? 0;
            const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens);

            const imageCallOutputs = response.output.filter(
                (output): output is ImageGenerationCallWithPrompt => output.type === 'image_generation_call' && Boolean(output.result)
            );
            const successfulImageCount = imageCallOutputs.length || 1;
            const finalStyle = imageCall.style_preset ?? style;

            const textCostEstimate = estimateTextCost(model as TextModelPricingKey, inputTokens, outputTokens);
            const imageCostEstimate = estimateImageGenerationCost({
                quality,
                size: dimensions,
                imageCount: successfulImageCount
            });
            const totalCost = textCostEstimate.totalCost + imageCostEstimate.totalCost;

            logger.debug(
                `Image generation usage - inputTokens: ${inputTokens}, outputTokens: ${outputTokens}, images: ${successfulImageCount}, estimatedCost: ${formatUsd(totalCost)}`
            );

            const outputResponseIdField = embed.data.fields?.find(field => field.name === 'Output ID');
            if (outputResponseIdField) {
                setOrAddEmbedField(embed, 'Output ID', response.id ? `\`${response.id}\`` : 'n/a', { inline: true });
            }

            const progressIndex = embed.data.fields?.findIndex(field => field.name === 'Progress') ?? -1;
            if (progressIndex >= 0) {
                embed.spliceFields(progressIndex, 1);
            }

            const embedTitle = reflection.title ? `🎨 ${reflection.title}` : '🎨 Image Generation';
            embed.setTitle(truncateForEmbed(embedTitle, EMBED_TITLE_LIMIT));

            if (reflection.description) {
                setEmbedDescription(embed, reflection.description);
            }

            const revisedPrompt = reflection.adjustedPrompt ?? imageCall.revised_prompt ?? null;

            const finalImageBuffer = Buffer.from(finalImageBase64, 'base64');
            let imageUrl: string | null = null;
            let attachment: AttachmentBuilder | null = null;

            if (isCloudinaryConfigured) {
                try {
                    imageUrl = await uploadToCloudinary(finalImageBuffer, {
                        originalPrompt: prompt,
                        revisedPrompt,
                        title: reflection.title,
                        description: reflection.description,
                        reflectionMessage: reflection.reflection,
                        model,
                        quality,
                        size: dimensions,
                        background,
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
                    embed.setImage(imageUrl);
                } catch (uploadError) {
                    logger.error('Error uploading to Cloudinary:', uploadError);
                    attachment = new AttachmentBuilder(finalImageBuffer, { name: `daneel-image-${Date.now()}.png` });
                    embed.setImage(`attachment://${attachment.name}`);
                }
            } else {
                logger.warn('Cloudinary credentials missing; sending generated image as attachment.');
                attachment = new AttachmentBuilder(finalImageBuffer, { name: `daneel-image-${Date.now()}.png` });
                embed.setImage(`attachment://${attachment.name}`);
            }

            const descriptionParts = [
                `**Prompt:** ${truncateForEmbed(prompt, 500)}`,
                adjustPrompt 
                    ? `**Adjusted (${model}):** ${truncateForEmbed(revisedPrompt ?? 'Model reused the original prompt.', 500)}`
                    : '*Prompt adjustment disabled.*'
            ];
            embed.setDescription(descriptionParts.join('\n'));

            setOrAddEmbedField(embed, 'Style', finalStyle, { inline: true });

            const generationTimeInSeconds = (Date.now() - start) / 1000;
            const generationTime = generationTimeInSeconds >= 60
                ? `${(generationTimeInSeconds / 60).toFixed(1)}m` // If > 60 seconds, x.x minutes,
                : `${generationTimeInSeconds.toFixed(0)}s`; // otherwise x seconds
            const imgPercent = parseInt(((imageCostEstimate.totalCost / totalCost) * 100).toFixed(0));
            const txtPercent = parseInt((100 - imgPercent).toFixed(0)); // Ensure they add up to 100% (may not be exact, but its good enough)
            setEmbedFooterText(
                embed,
                `⏱️ ${generationTime} • ${formatUsd(totalCost, 4)} • 🖼️${imgPercent}% 📝${txtPercent}%`
            );

            // Process reflection message if it exists
            const reflectionMessage = reflection.reflection 
                ? truncateForEmbed(reflection.reflection, REFLECTION_MESSAGE_LIMIT, { includeTruncationNote: true })
                : '';

            // Update the message with or without reflection
            await interaction.editReply({ 
                content: reflectionMessage.trim() || undefined, 
                embeds: [embed], 
                files: attachment ? [attachment] : [] 
            });
        } catch (error) {
            await editChain;
            logger.error('Error in image command:', error);

            const errorMessage = resolveImageCommandError(error);
            embed.setColor(0xFF0000);

            const outputResponseIdField = embed.data.fields?.find(field => field.name === 'Output ID');
            if (outputResponseIdField && outputResponseIdField.value === '…') {
                setOrAddEmbedField(embed, 'Output ID', 'n/a', { inline: true });
            }

            try {
                await interaction.editReply({ content: `⚠️ ${errorMessage}`, embeds: [] });
            } catch (replyError) {
                logger.error('Failed to edit reply after image command error:', replyError);
                try {
                    await interaction.followUp({ content: `⚠️ ${errorMessage}` });
                } catch (followUpError) {
                    logger.error('Failed to send follow-up after image command error:', followUpError);
                }
            }
        }
    }
};

export default imageCommand;
