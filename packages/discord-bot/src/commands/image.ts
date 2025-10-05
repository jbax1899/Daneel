import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, type APIEmbedField } from 'discord.js';
import { Command } from './BaseCommand.js';
import { OpenAI } from 'openai';
import { APIError } from 'openai/error';
import type { Response, ResponseCreateParamsNonStreaming, ResponseInput, ResponseOutputItem, Tool, ToolChoiceTypes } from 'openai/resources/responses/responses';
import { logger } from '../utils/logger.js';
import { imageCommandRateLimiter } from '../utils/RateLimiter.js';
import { v2 as cloudinary } from 'cloudinary';
import { CombinedPropertyError } from '@sapphire/shapeshift';
import {
    describeTokenUsage,
    estimateImageGenerationCost,
    estimateTextCost,
    formatUsd,
    type ImageGenerationQuality,
    type ImageGenerationSize,
    type TextModelPricingKey
} from '../utils/pricing.js';

const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
};

const isCloudinaryConfigured = Boolean(
    cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret
);

if (isCloudinaryConfigured) {
    cloudinary.config(cloudinaryConfig);
} else {
    logger.warn('Cloudinary credentials are missing. Image uploads are disabled.');
}

type ImageResponseModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano';
type ImageQualityType = ImageGenerationQuality;
type ImageAspectRatioType = 'auto' | 'square' | 'portrait' | 'landscape';
type ImageSizeType = ImageGenerationSize;
type ImageBackgroundType = 'auto' | 'transparent' | 'opaque';

type ImageGenerationCallWithPrompt = ResponseOutputItem.ImageGenerationCall & {
    revised_prompt?: string | null;
};

const EMBED_FIELD_VALUE_LIMIT = 1024;
const EMBED_FOOTER_TEXT_LIMIT = 2048;
const EMBED_DESCRIPTION_LIMIT = 4096;

function sanitizeForEmbed(value: string): string {
    return value.replace(/\u0000/g, '');
}

function truncateForEmbed(value: string, limit: number, options: { includeTruncationNote?: boolean } = {}): string {
    const sanitized = sanitizeForEmbed(value);

    if (sanitized.length <= limit) {
        return sanitized;
    }

    const ellipsis = '…';
    const truncationNote = options.includeTruncationNote ? '\n*(truncated)*' : '';
    const availableLength = Math.max(0, limit - ellipsis.length - truncationNote.length);
    const truncated = sanitized.slice(0, availableLength);
    return `${truncated}${ellipsis}${truncationNote}`;
}

function setEmbedFooterText(embed: EmbedBuilder, text: string) {
    embed.setFooter({ text: truncateForEmbed(text, EMBED_FOOTER_TEXT_LIMIT) });
}

function setEmbedDescription(embed: EmbedBuilder, description: string) {
    embed.setDescription(truncateForEmbed(description, EMBED_DESCRIPTION_LIMIT));
}

function setOrAddEmbedField(
    embed: EmbedBuilder,
    name: string,
    value: string,
    { inline = false, includeTruncationNote = false, maxLength = EMBED_FIELD_VALUE_LIMIT }: {
        inline?: boolean;
        includeTruncationNote?: boolean;
        maxLength?: number;
    } = {}
) {
    const formattedValue = truncateForEmbed(value, maxLength, { includeTruncationNote });
    const field: APIEmbedField = inline ? { name, value: formattedValue, inline } : { name, value: formattedValue };

    const fields = embed.data.fields ?? [];
    const index = fields.findIndex(existingField => existingField.name === name);

    if (index >= 0) {
        embed.spliceFields(index, 1, field);
    } else {
        embed.addFields(field);
    }
}

class CloudinaryConfigurationError extends Error {
    constructor(message = 'Cloudinary configuration is missing.') {
        super(message);
        this.name = 'CloudinaryConfigurationError';
    }
}

/**
 * Generates an image based on the provided prompt.
 */
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
            .setDescription('The model to use for prompt adjustment (optional; defaults to gpt-4o-mini)')
            .addChoices(
                { name: 'gpt-4o', value: 'gpt-4o' },
                { name: 'gpt-4o-mini', value: 'gpt-4o-mini' },
                { name: 'gpt-4.1', value: 'gpt-4.1' },
                { name: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
                { name: 'gpt-4.1-nano', value: 'gpt-4.1-nano' }
            )
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('follow_up_response_id')
            .setDescription('Response ID from a previous image generation for follow-up (optional)')
            .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // Check rate limit per user, channel, and guild
        // Bypass for developer user
        if (interaction.user.id !== process.env.DEVELOPER_USER_ID) {
            const { allowed, retryAfter, error } = imageCommandRateLimiter.checkRateLimitImageCommand(interaction.user.id);
            if (!allowed) {
                const seconds = retryAfter ?? 0;
                const minutes = Math.floor(seconds / 60);
                await interaction.reply({ content: `⚠️ ${error} Try again in ${minutes}m${seconds % 60}s`, flags: [1 << 6] });
                return;
            }
        }

        // Get the prompt from the interaction, if none provided, return an error
        const prompt = interaction.options.getString('prompt');
        if (!prompt) {
            await interaction.reply({
                content: '⚠️ No prompt provided.',
                flags: [1 << 6]
            });
            return;
        }
        logger.debug(`Received image generation request with prompt: ${prompt}`);

        // Defer the reply to show that the command is being processed
        await interaction.deferReply();

        // Start the timer
        const start = Date.now();

        // Check if Cloudinary is configured
        if (!isCloudinaryConfigured) {
            await interaction.editReply({
                content: '⚠️ Image generation is temporarily unavailable because Cloudinary credentials are not configured.',
                flags: [1 << 6]
            });
            return;
        }

        // Grab the aspect ratio from the interaction, if provided
        let dimensions: ImageSizeType = 'auto'; // By default, use auto to let OpenAI determine the aspect ratio
        const aspectRatio = interaction.options.getString('aspect_ratio') as ImageAspectRatioType | null;
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

        // Get parameters
        const isSuperUser = interaction.user.id === process.env.DEVELOPER_USER_ID;
        const requestedQuality = interaction.options.getString('quality') as ImageQualityType | null;
        let quality: ImageQualityType = requestedQuality ?? 'low';
        let qualityRestricted = false;
        if ((quality === 'medium' || quality === 'high') && !isSuperUser) {
            quality = 'low';
            qualityRestricted = true;
            logger.warn(`User ${interaction.user.id} attempted to use restricted quality setting '${requestedQuality}'. Falling back to 'low'.`);
        }
        const model = (interaction.options.getString('model') as ImageResponseModel | null) ?? 'gpt-4o-mini';
        const background = (interaction.options.getString('background') as ImageBackgroundType | null) ?? 'auto';
        const adjustPrompt = interaction.options.getBoolean('adjust_prompt') ?? true;
        let followUpResponseId = interaction.options.getString('follow_up_response_id');

        // If the response ID was not prefixed with 'resp_', add it
        if (followUpResponseId && !followUpResponseId.startsWith('resp_')) {
            followUpResponseId = `resp_${followUpResponseId}`;
            logger.warn(`Follow-up response ID was not prefixed with 'resp_'. Adding prefix: ${followUpResponseId}`);
        }

        // Create an initial embed to show the image generation progress
        const embed = new EmbedBuilder()
            .setTitle('🎨 Image Generation')
            .setColor(0x00FF00)
            .setTimestamp();

        setOrAddEmbedField(embed, 'Prompt', prompt, { includeTruncationNote: true });
        setEmbedFooterText(embed, 'Generating...');

        if (adjustPrompt) {
            setOrAddEmbedField(embed, 'Adjusted Prompt', '...');
        }

        setOrAddEmbedField(embed, 'Size', dimensions !== 'auto' ? `${aspectRatio ?? 'custom'} (${dimensions})` : 'auto', { inline: true });
        setOrAddEmbedField(embed, 'Quality', qualityRestricted ? `${quality} (restricted)` : quality, { inline: true });
        setOrAddEmbedField(embed, 'Background', background, { inline: true });
        setOrAddEmbedField(embed, 'Model', model, { inline: true });
        setOrAddEmbedField(embed, 'Input Response ID', followUpResponseId ? `\`${followUpResponseId}\`` : 'None', { inline: true });
        setOrAddEmbedField(embed, 'Output Response ID', '...', { inline: true });

        // Edit the initial reply with the embed
        await interaction.editReply({
            embeds: [embed]
        });

        try {
            const openai = new OpenAI();

            // Prepare the input for the responses API
            const input: ResponseInput = [
                {
                    role: 'user',
                    type: 'message',
                    content: [{ type: 'input_text', text: prompt }]
                }
            ];

            // User has requested to not adjust the prompt
            // Technically OpenAI will still try to adjust the prompt, this will keep it roughly the same
            if (!adjustPrompt) {
                input.unshift({
                    role: 'developer',
                    type: 'message',
                    content: [
                        {
                            type: 'input_text',
                            text: `User has requested to not adjust the prompt. Do not modify, expand, or rephrase the user's text in any way. Use the prompt exactly as provided.`
                        }
                    ]
                });
            }

            // Configure the image generation tool with all options
            const imageTool: Tool.ImageGeneration = {
                type: 'image_generation',
                size: dimensions,
                quality,
                background
            };

            const toolChoice: ToolChoiceTypes = { type: 'image_generation' };

            const tools: Tool[] = [imageTool];

            // Add previous response context if this is a follow-up
            const requestPayload: ResponseCreateParamsNonStreaming = {
                model,
                input,
                tools,
                tool_choice: toolChoice,
                previous_response_id: followUpResponseId ?? null
            };

            logger.debug(`Request payload: ${JSON.stringify(requestPayload, null, 2)}`);

            // Generate the image using responses API
            const response = await openai.responses.create(requestPayload);

            if (response.error) {
                const errorMessage = mapResponseError(response.error);
                logger.warn(`OpenAI response error for image command: ${response.error.code} - ${response.error.message}`);
                embed.setColor(0xFF0000);
                setEmbedFooterText(embed, errorMessage);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (response.incomplete_details?.reason === 'content_filter') {
                const safetyMessage = 'OpenAI safety filters blocked this prompt. Please modify your prompt and try again.';
                embed.setColor(0xFF0000);
                setEmbedFooterText(embed, safetyMessage);
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Extract image generation call information
            const imageGenerationCalls = response.output.filter(
                (output): output is ImageGenerationCallWithPrompt => output.type === 'image_generation_call'
            );

            if (imageGenerationCalls.length === 0) {
                throw new Error('No image generation call found in response. The model may not have decided to generate an image.');
            }

            const imageCallWithResult = imageGenerationCalls.find(call => Boolean(call.result));
            const imageCall = imageCallWithResult ?? imageGenerationCalls[0];
            const imageData = imageCall?.result;

            // Check if image data exists
            if (!imageCall || !imageData) {
                throw new Error('No image data found in the image generation call result.');
            }

            logger.debug(`Image generation successful - ID: ${imageCall.id}, Status: ${imageCall.status}`);

            // Update embed fields
            const revisedPrompt = imageCall.revised_prompt ?? null;
            if (adjustPrompt) {
                setOrAddEmbedField(embed, 'Adjusted Prompt', revisedPrompt ?? 'None', { includeTruncationNote: true });
            }

            if (response.id) {
                setOrAddEmbedField(embed, 'Output Response ID', `\`${response.id}\``, { inline: true });
            }

            const usage = response.usage;
            const inputTokens = usage?.input_tokens ?? 0;
            const outputTokens = usage?.output_tokens ?? 0;
            const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens);

            const textCostEstimate = estimateTextCost(model as TextModelPricingKey, inputTokens, outputTokens);
            const successfulImageCount = imageGenerationCalls.filter(call => Boolean(call.result)).length || 1;
            const imageCostEstimate = estimateImageGenerationCost({ quality, size: dimensions, imageCount: successfulImageCount });
            const totalCost = textCostEstimate.totalCost + imageCostEstimate.totalCost;

            logger.debug(`Image generation usage - inputTokens: ${inputTokens}, outputTokens: ${outputTokens}, images: ${successfulImageCount}, estimatedCost: ${formatUsd(totalCost)}`);

            const usageFieldValue = [
                `Text tokens → In: ${inputTokens} • Out: ${outputTokens} • Total: ${totalTokens}`,
                `Image calls → ${imageCostEstimate.imageCount} × ${imageCostEstimate.effectiveSize} (${imageCostEstimate.effectiveQuality})`,
                `Estimated cost → Text ${formatUsd(textCostEstimate.totalCost)} • Image ${formatUsd(imageCostEstimate.totalCost)} • Total ${formatUsd(totalCost)}`
            ].join('\n');

            setOrAddEmbedField(embed, 'Usage', usageFieldValue);

            // Upload image to Cloudinary
            let imageUrl: string;
            try {
                imageUrl = await uploadToCloudinary(Buffer.from(imageData, 'base64'), {
                    originalPrompt: prompt,
                    revisedPrompt,
                    model,
                    quality,
                    size: dimensions,
                    background,
                    startTime: start,
                    usage: {
                        inputTokens,
                        outputTokens,
                        totalTokens,
                        imageCount: imageCostEstimate.imageCount
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
                // Fallback to sending the image as a file
                embed.setImage(`data:image/png;base64,${imageData}`);
                logger.debug('Image sent as file');
            }

            // Update embed footer
            const generationTimeSeconds = ((Date.now() - start) / 1000).toFixed(0);
            setEmbedFooterText(
                embed,
                `Finished in ${generationTimeSeconds}s • ${describeTokenUsage(usage)} • Cost ≈ ${formatUsd(totalCost)}`
            );

            // Edit the initial reply with the final embed
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Error in image command:', error);

            const errorMessage = resolveImageCommandError(error);
            embed.setColor(0xFF0000);

            const outputResponseIdField = embed.data.fields?.find(field => field.name === 'Output Response ID');
            if (outputResponseIdField && outputResponseIdField.value === '...') {
                setOrAddEmbedField(embed, 'Output Response ID', 'n/a', { inline: true });
            }

            setEmbedFooterText(embed, errorMessage);
            setEmbedDescription(embed, errorMessage);

            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (replyError) {
                logger.error('Failed to edit reply after image command error:', replyError);
            }
        }
    }
};

interface UploadMetadata {
    originalPrompt: string;
    revisedPrompt?: string | null;
    model: ImageResponseModel;
    quality: ImageQualityType;
    size: ImageSizeType;
    background: ImageBackgroundType;
    startTime: number;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        imageCount: number;
    };
    cost: {
        text: number;
        image: number;
        total: number;
        perImage: number;
    };
}

/**
 * Uploads an image buffer to Cloudinary and returns the URL
 */
async function uploadToCloudinary(imageBuffer: Buffer, metadata: UploadMetadata): Promise<string> {
    if (!isCloudinaryConfigured) {
        throw new CloudinaryConfigurationError();
    }

    try {
        logger.debug(`Uploading image to Cloudinary with estimated cost ${formatUsd(metadata.cost.total)} and ${metadata.usage.totalTokens} tokens...`);

        const uploadResult = await cloudinary.uploader.upload(
            `data:image/png;base64,${imageBuffer.toString('base64')}`,
            {
                resource_type: 'image',
                public_id: `ai-image-${Date.now()}`,
                context: {
                    original_prompt: metadata.originalPrompt,
                    revised_prompt: metadata.revisedPrompt,
                    model: metadata.model,
                    quality: metadata.quality,
                    size: metadata.size,
                    background: metadata.background,
                    generated_at: new Date().toISOString(),
                    generation_time: `${(Date.now() - metadata.startTime) / 1000}s`,
                    tokens_used: metadata.usage.totalTokens.toString(),
                    text_input_tokens: metadata.usage.inputTokens.toString(),
                    text_output_tokens: metadata.usage.outputTokens.toString(),
                    image_count: metadata.usage.imageCount.toString(),
                    cost_text_usd: formatUsd(metadata.cost.text),
                    cost_image_usd: formatUsd(metadata.cost.image),
                    cost_total_usd: formatUsd(metadata.cost.total),
                    cost_per_image_usd: formatUsd(metadata.cost.perImage)
                },
                tags: ['ai-generated', 'discord-bot', metadata.model, metadata.quality]
            }
        );

        logger.debug(`Image uploaded to Cloudinary: ${uploadResult.secure_url}`);
        return uploadResult.secure_url;
    } catch (error) {
        logger.error(`Cloudinary upload error: ${error}`);
        throw error;
    }
}

function mapResponseError(error: NonNullable<Response['error']>): string {
    switch (error.code) {
        case 'image_content_policy_violation':
            return 'OpenAI safety filters blocked this prompt. Please modify your prompt and try again.';
        case 'rate_limit_exceeded':
            return 'OpenAI rate limit hit. Please wait a few moments and try again.';
        case 'invalid_prompt':
            return `OpenAI could not process the prompt: ${error.message}`;
        case 'server_error':
            return 'OpenAI had a temporary issue generating the image. Please try again.';
        case 'invalid_image':
        case 'invalid_image_format':
        case 'invalid_base64_image':
        case 'invalid_image_url':
        case 'image_too_large':
        case 'image_too_small':
        case 'image_parse_error':
        case 'invalid_image_mode':
        case 'image_file_too_large':
        case 'unsupported_image_media_type':
        case 'empty_image_file':
        case 'failed_to_download_image':
        case 'image_file_not_found':
            return `Image processing error: ${error.message}`;
        default:
            return `OpenAI error: ${error.message}`;
    }
}

function resolveImageCommandError(error: unknown): string {
    if (error instanceof CloudinaryConfigurationError) {
        return 'Cloudinary is not configured. Please contact the administrator.';
    }

    if (error instanceof CombinedPropertyError) {
        logger.warn('Discord embed validation failed while preparing an image response: %s', error);
        return 'Discord rejected the response format. Please try again with a shorter or simpler prompt.';
    }

    if (error instanceof APIError) {
        const code = extractApiErrorCode(error);
        if (code === 'content_policy_violation' || code === 'image_content_policy_violation') {
            return 'OpenAI safety filters blocked this prompt. Please modify your prompt and try again.';
        }
        if (code === 'rate_limit_exceeded' || error.status === 429) {
            return 'OpenAI rate limit hit. Please wait a few moments and try again.';
        }
        if (error.status === 401 || error.status === 403) {
            return 'OpenAI rejected our request. Please contact the administrator.';
        }
        if (error.status === 400 && /invalid[_\s-]*prompt/i.test(error.message ?? '')) {
            return 'OpenAI reported that the prompt was invalid. Please try again with a simpler request.';
        }
        if (error.status >= 500) {
            return 'OpenAI had a temporary issue generating the image. Please try again.';
        }
        return error.message || 'OpenAI returned an unexpected error.';
    }

    if (error instanceof Error) {
        const message = error.message || 'Unknown error.';
        if (/content filter|safety system|moderation/i.test(message)) {
            return 'OpenAI safety filters blocked this prompt. Please modify your prompt and try again.';
        }
        if (/quota/i.test(message)) {
            return 'Quota exceeded: Please try again later.';
        }
        if (/network|timeout|fetch/i.test(message)) {
            return 'Network error: Please try again later.';
        }
        if (/model/i.test(message)) {
            return 'Model error: The specified model is not supported for image generation.';
        }
        return message;
    }

    return 'An unknown error occurred while generating the image.';
}

function extractApiErrorCode(error: APIError): string | undefined {
    if (typeof error.code === 'string') {
        return error.code;
    }

    const apiError = error.error as { code?: string } | undefined;
    if (apiError && typeof apiError.code === 'string') {
        return apiError.code;
    }

    return undefined;
}

export default imageCommand;
