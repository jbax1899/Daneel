import { SlashCommandBuilder } from 'discord.js';
import { openaiService } from '../index.js';
import { EmbedBuilder } from '../utils/response/EmbedBuilder.js';
import { renderPrompt } from '../utils/env.js';
import { logger } from '../utils/logger.js';
const DEFAULT_MAX_RESULTS = 3;
const MAX_RESULTS = 5;
const newsFunction = {
    name: "generate_news_response",
    description: "Generates a structured news response with multiple news items and a summary",
    parameters: {
        type: "object",
        properties: {
            news: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "Title of the news article" },
                        summary: { type: "string", description: "Summary of the news article" },
                        url: { type: "string", description: "URL to the full article" },
                        source: { type: "string", description: "Source of the article" },
                        timestamp: { type: "string", description: "Publication timestamp" },
                        thumbnail: { type: "string", description: "URL to article thumbnail image", nullable: true }
                    },
                    required: ["title", "summary", "url", "source", "timestamp"]
                }
            },
            summary: {
                type: "string",
                description: "A brief summary of the news findings"
            }
        },
        required: ["news", "summary"]
    }
};
const newsCommand = {
    data: new SlashCommandBuilder()
        .setName('news')
        .setDescription('Get the latest news')
        .addStringOption(option => option
        .setName('query')
        .setDescription('Search query (e.g. "AI", "climate change")')
        .setRequired(false))
        .addStringOption(option => option
        .setName('category')
        .setDescription('News category (e.g., tech, sports, politics)')
        .setRequired(false))
        .addIntegerOption(option => option
        .setName('max_results')
        .setDescription('Maximum number of news items to return')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(MAX_RESULTS))
        .addStringOption(option => option
        .setName('allowed_domains')
        .setDescription('Comma-separated list of allowed domains (e.g., bbc.com,nytimes.com)')
        .setRequired(false))
        .addStringOption(option => option
        .setName('reasoning_effort')
        .setDescription('How much effort to put into reasoning')
        .addChoices({ name: 'Minimal', value: 'minimal' }, { name: 'Low', value: 'low' }, { name: 'Medium', value: 'medium' }, { name: 'High', value: 'high' })
        .setRequired(false))
        .addStringOption(option => option
        .setName('verbosity')
        .setDescription('How verbose the response should be')
        .addChoices({ name: 'Low', value: 'low' }, { name: 'Medium', value: 'medium' }, { name: 'High', value: 'high' })
        .setRequired(false)),
    async execute(interaction) {
        // Log command execution with timestamp and interaction ID
        logger.info(`[${new Date().toISOString()}] Executing /news command - Interaction ID: ${interaction.id}`);
        logger.info(`Interaction details:`, {
            id: interaction.id,
            commandName: interaction.commandName,
            user: interaction.user.tag,
            channel: interaction.channel?.id,
            guild: interaction.guild?.id,
            token: interaction.token ? 'PRESENT' : 'MISSING',
            isCommand: interaction.isChatInputCommand(),
            options: interaction.options.data.map(opt => ({ name: opt.name, value: opt.value }))
        });
        // Immediately acknowledge the interaction
        let isDeferred = false;
        try {
            logger.info(`About to call deferReply() for interaction ${interaction.id}`);
            await interaction.deferReply();
            isDeferred = true;
            logger.info(`Successfully deferred interaction ${interaction.id}`);
        }
        catch (deferError) {
            logger.error(`Failed to defer interaction ${interaction.id}: ${deferError}`);
            // If defer fails, try to reply directly
            try {
                await interaction.reply({
                    content: 'An error occurred while processing your request. Please try again later.',
                    flags: [1 << 6] // EPHEMERAL
                });
                logger.info(`Successfully replied directly to interaction ${interaction.id}`);
            }
            catch (replyError) {
                logger.error(`Failed to reply to interaction ${interaction.id}: ${replyError}`);
            }
            return;
        }
        // Set a timeout for the entire operation
        const timeoutMs = 120000; // 2 minutes timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timed out after 2 minutes')), timeoutMs);
        });
        try {
            const query = interaction.options.getString('query') ?? '';
            const category = interaction.options.getString('category') ?? '';
            const allowedDomains = interaction.options.getString('allowed_domains')
                ? interaction.options.getString('allowed_domains').split(',').map(s => s.trim())
                : undefined;
            const reasoningEffort = interaction.options.getString('reasoning_effort') ?? 'medium';
            const verbosity = interaction.options.getString('verbosity') ?? 'medium';
            const maxResults = interaction.options.getInteger('max_results') ?? DEFAULT_MAX_RESULTS;
            const openAIOptions = {
                reasoningEffort: reasoningEffort,
                verbosity: verbosity,
                tool_choice: {
                    type: 'web_search',
                    function: { name: 'generate_news_response' }
                },
                webSearch: {
                    query: query || category || 'latest news',
                    allowedDomains,
                    searchContextSize: 'medium', // Reduced from 'high' to speed up
                    userLocation: { type: 'approximate' }
                }
            };
            const { content: systemPrompt } = renderPrompt('discord.news.system', {
                query: query || 'Not specified',
                category: category || 'Not specified',
                maxResults,
                allowedDomains: allowedDomains?.join(', ') || 'Any'
            });
            // Race between OpenAI response and timeout
            const response = await Promise.race([
                openaiService.generateResponse(undefined, [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `User provided arguments: ${JSON.stringify({ query, category, maxResults, allowedDomains, reasoningEffort, verbosity })}` }
                ], {
                    ...openAIOptions,
                    functions: [newsFunction],
                    function_call: { name: "generate_news_response" }
                }),
                timeoutPromise
            ]);
            // Process the tool call response
            const functionCall = response.message?.function_call;
            logger.info(`Function call: ${JSON.stringify(response)}`);
            if (!functionCall || !functionCall.arguments) {
                throw new Error('No function call returned from OpenAI');
            }
            const newsResponse = JSON.parse(functionCall.arguments);
            if (!newsResponse.news || !Array.isArray(newsResponse.news)) {
                throw new Error('Invalid news response format');
            }
            // TODO: REMOVE
            logger.info(`News response: ${JSON.stringify(newsResponse)}`);
            logger.info(`Image analysis for ${newsResponse.news.length} articles:`);
            newsResponse.news.forEach((item, index) => {
                const hasThumbnail = !!item.thumbnail;
                const hasImage = !!item.image;
                logger.info(`Article ${index + 1}: "${item.title}"`);
                logger.info(`  - Has thumbnail: ${hasThumbnail} ${hasThumbnail ? `(URL: ${item.thumbnail})` : ''}`);
                logger.info(`  - Has image: ${hasImage} ${hasImage ? `(URL: ${item.image})` : ''}`);
            });
            // Create embeds for each news item
            const embeds = newsResponse.news.slice(0, maxResults).map((item) => {
                const embed = new EmbedBuilder()
                    .setTitle(item.title)
                    .setDescription(item.summary)
                    .setURL(item.url)
                    .setFooter({ text: `Source: ${item.source} • ${new Date(item.timestamp).toLocaleString()}` });
                if (item.thumbnail) {
                    embed.setThumbnail({ url: item.thumbnail });
                }
                return embed.build();
            });
            // Create a header message
            const searchParams = [];
            if (query)
                searchParams.push(`query: "${query}"`);
            if (category)
                searchParams.push(`category: "${category}"`);
            if (allowedDomains?.length)
                searchParams.push(`sources: ${allowedDomains.join(', ')}`);
            const headerMessage = `**News** ${searchParams.length ? `for ${searchParams.join(', ')}` : 'from around the world'}`;
            const resultMessage = newsResponse.summary || `Found ${newsResponse.news.length} news items.`;
            await interaction.editReply({
                content: `${headerMessage}\n${resultMessage}`,
                embeds: embeds.slice(0, maxResults)
            });
        }
        catch (error) {
            logger.error(`Error in news command: ${error}`);
            try {
                if (isDeferred) {
                    await interaction.editReply('An error occurred while fetching news. Please try again later.');
                }
                else {
                    await interaction.reply({
                        content: 'An error occurred while fetching news. Please try again later.',
                        flags: [1 << 6] // EPHEMERAL
                    });
                }
            }
            catch (editError) {
                logger.error(`Failed to respond to interaction: ${editError}`);
            }
        }
    }
};
export default newsCommand;
//# sourceMappingURL=news.js.map