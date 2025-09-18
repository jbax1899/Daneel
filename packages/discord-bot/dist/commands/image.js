import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { OpenAI } from 'openai';
import { DEFAULT_IMAGE_GENERATION_MODEL, DEFAULT_IMAGE_GENERATION_QUALITY } from '../utils/openaiService.js';
import { logger } from '../utils/logger.js';
import { imageCommandRateLimiter } from '../utils/RateLimiter.js';
/**
 * Generates an image based on the provided prompt.
 */
const imageCommand = {
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Generate an image based on the prompt provided')
        .addStringOption(option => option
        .setName('prompt')
        .setDescription('The prompt to generate the image from')
        .setRequired(true))
        .addStringOption(option => option
        .setName('aspect_ratio')
        .setDescription('The aspect ratio to use (optional; defaults to auto)')
        .addChoices({ name: 'Square', value: 'square' }, { name: 'Portrait', value: 'portrait' }, { name: 'Landscape', value: 'landscape' })
        .setRequired(false)),
    // TODO: optional (rate limitted) arguments for model, resolution, and quality
    async execute(interaction) {
        // Check rate limit per user, channel, and guild
        const { allowed, retryAfter, error } = imageCommandRateLimiter.checkRateLimitImageCommand(interaction.user.id);
        if (!allowed) {
            const seconds = retryAfter ?? 0;
            const minutes = Math.floor(seconds / 60);
            await interaction.reply({ content: `⚠️ ${error} Try again in ${minutes}m${seconds % 60}s`, ephemeral: true });
            return;
        }
        // Start the timer
        const start = Date.now();
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
        let aspect_ratio = 'auto'; // By default, use auto to let OpenAI determine the aspect ratio
        if (interaction.options.getString('aspect_ratio')) {
            switch (interaction.options.getString('aspect_ratio')) {
                case 'square':
                    aspect_ratio = '1024x1024';
                    break;
                case 'portrait':
                    aspect_ratio = '1024x1536';
                    break;
                case 'landscape':
                    aspect_ratio = '1536x1024';
                    break;
            }
        }
        // Create an initial embed to show the image generation progress
        const embed = new EmbedBuilder()
            .setTitle('🎨 Image Generation')
            .setDescription(`**Prompt:** "${prompt}"\n**Size:** ${aspect_ratio !== 'auto' ? `${interaction.options.getString('aspect_ratio')} (${aspect_ratio})` : 'auto'}`)
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: 'Generating...' });
        // Defer the reply to show that the command is being processed
        await interaction.deferReply();
        // Edit the initial reply with the embed
        await interaction.editReply({
            embeds: [embed]
        });
        try {
            const openai = new OpenAI();
            // Start streaming the image generation
            // https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1&lang=javascript&api=image&multi-turn=responseid
            const stream = await openai.images.generate({
                prompt: prompt,
                model: DEFAULT_IMAGE_GENERATION_MODEL,
                size: aspect_ratio,
                quality: DEFAULT_IMAGE_GENERATION_QUALITY,
                stream: true,
                partial_images: 3,
            });
            // Each time we get a partial image or completed image, send it to Discord
            for await (const event of stream) {
                const imageBuffer = Buffer.from(event.b64_json, "base64");
                if (event.type === "image_generation.partial_image") {
                    // Send partial image to Discord
                    // Update embed with partial image index
                    const idx = event.partial_image_index;
                    embed.setFooter({ text: `Received partial image ${idx + 1}` });
                    logger.debug(`Received partial image ${idx + 1}`);
                    await interaction.editReply({ files: [imageBuffer], embeds: [embed] });
                }
                if (event.type === "image_generation.completed") {
                    // Send final image to Discord
                    embed.setFooter({ text: `Finished in ${(Date.now() - start) / 1000}s` });
                    await interaction.editReply({ files: [imageBuffer], embeds: [embed] });
                }
            }
        }
        catch (error) {
            console.error(`Error in image command: ${error}`);
            embed.setFooter({ text: `${error ? error : 'An unknown error occurred while generating the image.'}` });
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
export default imageCommand;
//# sourceMappingURL=image.js.map