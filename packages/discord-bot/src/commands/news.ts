import { SlashCommandBuilder } from 'discord.js';
import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from './BaseCommand.js';
import { openaiService } from '../index.js';
import { OpenAIOptions } from '../utils/openaiService.js';
import { EmbedBuilder } from '../utils/response/EmbedBuilder.js';
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

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get the latest news')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search query (e.g. "AI", "climate change")')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('News category (e.g., tech, sports, politics)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('max_results')
        .setDescription('Maximum number of news items to return')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(MAX_RESULTS)
    )
    .addStringOption(option =>
      option
        .setName('allowed_domains')
        .setDescription('Comma-separated list of allowed domains (e.g., bbc.com,nytimes.com)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reasoning_effort')
        .setDescription('How much effort to put into reasoning')
        .addChoices(
          { name: 'Minimal', value: 'minimal' },
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' }
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('verbosity')
        .setDescription('How verbose the response should be')
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' }
        )
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Log command execution with timestamp and interaction ID
    logger.info(`[${new Date().toISOString()}] Executing /news command - Interaction ID: ${interaction.id}`);
    
    // Let the main handler manage the initial response
    await interaction.deferReply();
    
    try {
      const query = interaction.options.getString('query') ?? '';
      const category = interaction.options.getString('category') ?? '';
      const allowedDomains = interaction.options.getString('allowed_domains') 
        ? interaction.options.getString('allowed_domains')!.split(',').map(s => s.trim())
        : undefined;
      const reasoningEffort = interaction.options.getString('reasoning_effort') ?? 'medium';
      const verbosity = interaction.options.getString('verbosity') ?? 'medium';
      const maxResults = interaction.options.getInteger('max_results') ?? DEFAULT_MAX_RESULTS;

      const openAIOptions: OpenAIOptions = { 
        reasoningEffort: reasoningEffort as 'minimal' | 'low' | 'medium' | 'high', 
        verbosity: verbosity as 'low' | 'medium' | 'high',
        tool_choice: {
          type: 'web_search',
          function: { name: 'generate_news_response' }
        },
        webSearch: {
          query: query || category || 'latest news',
          allowedDomains,
          searchContextSize: 'high',
          userLocation: { type: 'approximate' }
        }
      };

      const systemPrompt = `You are a news assistant that fetches and summarizes current news using web search.
      INSTRUCTIONS:
      1. ALWAYS use the generate_news_response function to return results
      2. Use web search to find the most recent and relevant news
      3. Include a concise 1-2 sentence summary of the overall findings
      4. Return ${maxResults} news items by default unless specified otherwise
      5. Format each news item with: title, summary, url, source, and timestamp
      Search parameters:
      - Query: ${query || 'Not specified'}
      - Category: ${category || 'Not specified'}
      - Max results: ${maxResults}
      - Allowed domains: ${allowedDomains?.join(', ') || 'Any'}`;

      const response = await openaiService.generateResponse(
        undefined,
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: `User provided arguments: ${JSON.stringify({ query, category, maxResults, allowedDomains, reasoningEffort, verbosity })}`}
        ],
        {
          ...openAIOptions,
          functions: [newsFunction],
          function_call: { name: "generate_news_response" }
        }
      );

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

      // Create embeds for each news item
      const embeds = newsResponse.news.slice(0, maxResults).map((item: any) => {
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
      if (query) searchParams.push(`query: "${query}"`);
      if (category) searchParams.push(`category: "${category}"`);
      if (allowedDomains?.length) searchParams.push(`sources: ${allowedDomains.join(', ')}`);
      
      const headerMessage = `**News** ${searchParams.length ? `for ${searchParams.join(', ')}` : 'from around the world'}`;
      const resultMessage = newsResponse.summary || `Found ${newsResponse.news.length} news items.`;
      
      await interaction.editReply({ 
        content: `${headerMessage}\n${resultMessage}`,
        embeds: embeds.slice(0, maxResults)
      });

    } catch (error) {
      logger.error(`Error in news command: ${error}`);
      await interaction.editReply('An error occurred while fetching news. Please try again later.');
    }
  }
};

export default command;