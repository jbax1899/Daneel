import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from './BaseCommand.js';
import { OpenAI } from 'openai';
import { logger } from '../utils/logger.js';
import { imageCommandRateLimiter } from '../utils/RateLimiter.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

type ImageResponseModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini';
type ImageQualityType = 'auto' | 'low' | 'medium' | 'high';
type ImageAspectRatioType = 'auto' | 'square' | 'portrait' | 'landscape';
type ImageSizeType = 'auto' | '1024x1024' | '1024x1536' | '1536x1024';
type ImageBackgroundType = 'auto' | 'transparent' | 'opaque';

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
                //{ name: 'Auto', value: 'auto' },
                { name: 'Low', value: 'low' },
                //{ name: 'Medium', value: 'medium' },
                //{ name: 'High', value: 'high' }
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
                await interaction.reply({ content: `⚠️ ${error} Try again in ${minutes}m${seconds % 60}s`, ephemeral: true });
                return;
            }
        }

        // Start the timer
        const start = Date.now();

        // Defer the reply to show that the command is being processed
        await interaction.deferReply();

        // Get the prompt from the interaction, if none provided, return an error
        const prompt = interaction.options.getString('prompt');
        if (!prompt) {
            await interaction.reply({
                content: '⚠️ No prompt provided.',
                ephemeral: true
            });
            return;
        }
        logger.debug(`Received image generation request with prompt: ${prompt}`);

        // Grab the aspect ratio from the interaction, if provided
        let dimensions: ImageSizeType = 'auto'; // By default, use auto to let OpenAI determine the aspect ratio
        let aspect_ratio: ImageAspectRatioType = interaction.options.getString('aspect_ratio') as ImageAspectRatioType;
        if (aspect_ratio) {
            switch (aspect_ratio) {
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
        const quality = interaction.options.getString('quality') || 'low' as ImageQualityType;
        const model = interaction.options.getString('model') || 'gpt-4o-mini' as ImageResponseModel;
        const background = interaction.options.getString('background') || 'auto' as ImageBackgroundType;
        let followUpResponseId = interaction.options.getString('follow_up_response_id') || null;

        // If the response ID was not prefixed with 'resp_', add it
        if (followUpResponseId && !followUpResponseId.startsWith('resp_')) {
            followUpResponseId = `resp_${followUpResponseId}`;
            logger.warn(`Follow-up response ID was not prefixed with 'resp_'. Adding prefix: ${followUpResponseId}`);
        }

        // Create an initial embed to show the image generation progress
        const embed = new EmbedBuilder()
            .setTitle('🎨 Image Generation')
            //.setDescription(`User has requested an image to be generated based on the prompt:`)
            .addFields(
                { name: 'Prompt', value: prompt},
                { name: 'Adjusted Prompt', value: `...`},
                { name: 'Size', value: dimensions !== 'auto' ? `${interaction.options.getString('aspect_ratio')} (${dimensions}px)` : 'auto', inline: true },
                { name: 'Quality', value: quality, inline: true },
                { name: 'Background', value: background, inline: true },
                { name: 'Model', value: model, inline: true },
                { name: 'Ref. Response ID', value: followUpResponseId ? `\`${followUpResponseId}\`` : 'None', inline: true },
                { name: 'Output Response ID', value: '...', inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: 'Generating...' });

        

        // Edit the initial reply with the embed
        await interaction.editReply({
            embeds: [embed]
        });

        try {
            const openai = new OpenAI();

            // Prepare the input for the responses API
            const input: any[] = [{
                role: 'user' as const,
                content: [{ type: 'input_text' as const, text: prompt }]
            }];

            // Configure the image generation tool with all options
            const imageTool: any = {
                type: 'image_generation' as const,
                size: dimensions,
                quality: quality,
                background: background
            };

            // Add previous response context if this is a follow-up
            const requestPayload: any = {
                model: model,
                input,
                tools: [imageTool],
                tool_choice: { type: 'image_generation' }, // Force image generation
                previous_response_id: followUpResponseId || null
            };

            logger.debug(`Request payload: ${JSON.stringify(requestPayload, null, 2)}`);

            // Generate the image using responses API
            const response = await openai.responses.create(requestPayload);

            logger.debug(`OpenAI Response: ${JSON.stringify(response, null, 2)}`);

            // Extract image generation call information
            const imageGenerationCalls = response.output.filter(
                (output: any) => output.type === 'image_generation_call'
            );

            if (imageGenerationCalls.length === 0) {
                throw new Error('No image generation call found in response. The model may not have decided to generate an image.');
            }

            const imageCall = imageGenerationCalls[0];
            const imageData = (imageCall as any).result;

            // Check if image data exists
            if (!imageData) {
                throw new Error('No image data found in the image generation call result.');
            }

            logger.debug(`Image generation successful - ID: ${(imageCall as any).id}, Status: ${(imageCall as any).status}`);

            // Update embed fields
            const revisedPrompt = (imageCall as any).revised_prompt;
            if (revisedPrompt) {
                // Find and update the "Adjusted Prompt" field
                const adjustedPromptField = embed.data.fields?.find(field => field.name === 'Adjusted Prompt');
                if (adjustedPromptField) {
                    adjustedPromptField.value = revisedPrompt;
                }
            }
            // Find and update the "Output Response ID" field
            const outputResponseIdField = embed.data.fields?.find(field => field.name === 'Output Response ID');
            if (outputResponseIdField && response.id) {
                outputResponseIdField.value = `\`${response.id}\``;
            }

            // Upload image to Cloudinary
            const imageUrl = await uploadToCloudinary(Buffer.from(imageData, 'base64'), {
                originalPrompt: prompt,
                revisedPrompt: revisedPrompt,
                model: model,
                quality: quality,
                size: dimensions,
                background: background,
                response: response,
                startTime: start
            });

            // Set the image in the embed instead of sending as file
            embed.setImage(imageUrl);

            // Send final image to Discord
            embed.setFooter({ text: `Finished in ${((Date.now() - start) / 1000).toFixed(0)}s • ${response.usage?.total_tokens} Tokens` });
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Error in image command: ${error}`);
            
            // Enhanced error handling with specific messages
            let errorMessage = 'An unknown error occurred while generating the image.';
            if (error instanceof Error) {
                if (error.message.includes('model')) {
                    errorMessage = 'Model error: The specified model is not supported for image generation.';
                } else if (error.message.includes('quota')) {
                    errorMessage = 'Quota exceeded: Please try again later.';
                } else if (error.message.includes('safety')) {
                    errorMessage = 'Your request was rejected by the safety system: Please modify your prompt and try again.';
                } else if (error.message.includes('network') || error.message.includes('timeout')) {
                    errorMessage = 'Network error: Please try again later.';
                } else {
                    errorMessage = error.message;
                }
            }

            embed.setFooter({ text: errorMessage });
            await interaction.editReply({ embeds: [embed] });
        }
    }
};

/**
 * Uploads an image buffer to Cloudinary and returns the URL
 */
async function uploadToCloudinary(imageBuffer: Buffer, metadata: {
    originalPrompt: string;
    revisedPrompt: string;
    model: string;
    quality: string;
    size: string;
    background: string;
    response: any;
    startTime: number;
}): Promise<string> {
    try {
        logger.debug(`Uploading image to Cloudinary...`);

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
                    tokens_used: metadata.response.usage?.total_tokens || 'unknown',
                    generation_time: `${(Date.now() - metadata.startTime) / 1000}s`
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

export default imageCommand;