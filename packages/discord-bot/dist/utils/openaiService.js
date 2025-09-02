import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { logger } from './logger.js';
// ====================
// Constants / Variables
// ====================
const DEFAULT_GPT5_MODEL = 'gpt-5-mini';
const DEFAULT_MODEL = DEFAULT_GPT5_MODEL;
const GPT5_PRICING = {
    // Pricing per 1M tokens
    // https://platform.openai.com/docs/pricing
    'gpt-5': { input: 1.25, output: 10 },
    'gpt-5-mini': { input: 0.25, output: 2.0 },
    'gpt-5-nano': { input: 0.05, output: 0.4 },
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '..', 'output');
const TTS_OUTPUT_PATH = path.join(OUTPUT_PATH, 'tts');
const IMAGE_DESCRIPTION_MODEL = 'gpt-5-mini';
let isDirectoryInitialized = false; // Tracks if output directories have been initialized
// ====================
// OpenAI Service Class
// ====================
export class OpenAIService {
    openai;
    defaultModel = DEFAULT_MODEL;
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
        ensureDirectories();
    }
    async generateResponse(model = this.defaultModel, messages, options = {}) {
        return this.generateGPT5Response(model, messages, options);
    }
    async generateGPT5Response(model, messagesInput, options) {
        const { reasoningEffort = 'low', verbosity = 'low' } = options;
        try {
            // Map messages for the OpenAI Responses API
            const messages = messagesInput.map(msg => ({
                role: msg.role,
                content: [{
                        type: msg.role === 'assistant' ? 'output_text' : 'input_text',
                        text: msg.content
                    }]
            }));
            const tools = []; // Initialize tools array
            const doingWebSearch = typeof options.tool_choice === 'object' &&
                options.tool_choice !== null &&
                options.tool_choice.type === 'web_search';
            // Add web search tool if enabled
            if (doingWebSearch) {
                // Create web search tool
                const webSearchTool = {
                    type: 'web_search',
                };
                // Add optional web search parameters
                if (options.webSearch?.allowedDomains?.length) {
                    webSearchTool.filters = {
                        allowed_domains: options.webSearch.allowedDomains
                    };
                }
                if (options.webSearch?.searchContextSize) {
                    webSearchTool.search_context_size = options.webSearch.searchContextSize;
                }
                if (options.webSearch?.userLocation) {
                    webSearchTool.user_location = {
                        ...options.webSearch.userLocation
                    };
                }
                tools.push(webSearchTool);
            }
            // Add function tools if any (separate from web search tool)
            if (options.functions?.length) {
                tools.push(...options.functions.map(fn => ({
                    type: 'function',
                    name: fn.name,
                    description: fn.description || '',
                    parameters: fn.parameters || {},
                    strict: false
                })));
            }
            // Create request payload to pass to OpenAI
            const requestPayload = {
                model,
                input: [
                    ...messages,
                    ...(doingWebSearch ? [{
                            role: 'system',
                            content: `The planner instructed you to perform a web search for: ${options.webSearch?.query}`
                        }] : [])
                ],
                ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
                ...(verbosity && { text: { verbosity } }),
                ...(tools.length > 0 && { tools })
            };
            logger.debug(`Generating AI response with payload: ${JSON.stringify(requestPayload)}`); // TODO: Remove
            // Generate response
            const response = await this.openai.responses.create(requestPayload);
            // Get output items from response
            const outputItems = response.output;
            // Find the assistant's message and web search results
            let outputText = '';
            let finishReason = 'stop';
            const citations = [];
            for (const item of outputItems ?? []) {
                // Handle message with citations
                if (item.type === 'message' && item.role === 'assistant' && item.content) {
                    const textContent = item.content.find(c => c.type === 'output_text');
                    if (textContent?.text) {
                        outputText = textContent.text;
                        // Extract citations if any
                        if (textContent.annotations?.length) {
                            for (const annotation of textContent.annotations) {
                                if (annotation.type === 'url_citation' && annotation.url) {
                                    citations.push({
                                        url: annotation.url,
                                        title: annotation.title || 'Source',
                                        text: outputText.slice(annotation.start_index, annotation.end_index)
                                    });
                                }
                            }
                        }
                    }
                    finishReason = item.finish_reason || finishReason;
                    break;
                }
            }
            // Fall back to output_text if no message found
            if (!outputText) {
                const firstTextItem = outputItems.find(i => i.type === 'output_text' && i.content?.[0]?.text?.trim());
                outputText = firstTextItem?.content?.[0]?.text ?? '';
                finishReason = firstTextItem?.finish_reason ?? finishReason;
            }
            // Handle function calls if any
            let parsedFunctionCall = null;
            for (const item of outputItems ?? []) {
                if ((item.type === 'function_call' || item.type === 'tool_calls') && item.name) {
                    parsedFunctionCall = {
                        name: item.name,
                        arguments: item.arguments || '{}'
                    };
                    break;
                }
            }
            return {
                normalizedText: outputText,
                message: {
                    role: 'assistant',
                    content: outputText,
                    ...(parsedFunctionCall && { function_call: parsedFunctionCall }),
                    ...(citations.length > 0 && { citations })
                },
                finish_reason: finishReason,
                usage: {
                    input_tokens: response.usage?.input_tokens ?? 0,
                    output_tokens: response.usage?.output_tokens ?? 0,
                    total_tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
                    cost: this.calculateCost(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, model)
                }
            };
        }
        catch (error) {
            logger.error('Error in generateGPT5Response:', error);
            throw error;
        }
    }
    async generateSpeech(model, voice, input, instructions, filename, format) {
        //https://platform.openai.com/docs/guides/text-to-speech
        if (!filename || !/^[\w\-]+$/.test(filename)) {
            throw new Error('Invalid filename. Only alphanumeric characters, hyphens, and underscores are allowed.');
        }
        const outputPath = path.join(TTS_OUTPUT_PATH, `${filename}.${format}`);
        logger.debug(`Generating speech file: ${outputPath}...`);
        try {
            const mp3 = await this.openai.audio.speech.create({
                model: model,
                voice: voice,
                input: input,
                instructions: instructions,
                response_format: format,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            await fs.promises.writeFile(outputPath, buffer);
            logger.debug(`Generated speech file: ${outputPath}`);
            return outputPath;
        }
        catch (error) {
            // Clean up partially written file if it exists
            try {
                if (fs.existsSync(outputPath)) {
                    await fs.promises.unlink(outputPath);
                }
            }
            catch (cleanupError) {
                logger.error('Failed to clean up file after error:', cleanupError);
            }
            throw error;
        }
    }
    async generateImageDescription(imageUrl, // URL from Discord attachment
    context) {
        try {
            // Download the image from the URL
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }
            // Get the image data as a buffer
            const imageBuffer = await response.arrayBuffer();
            // Convert the image to base64
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            // Get the content type from the response headers or default to jpeg
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const chatResponse = await this.openai.chat.completions.create({
                model: IMAGE_DESCRIPTION_MODEL,
                messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `What's in this image?${context ? ` (Additional context: ${context})` : ''}`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${contentType};base64,${base64Image}`,
                                    detail: 'high'
                                }
                            }
                        ]
                    }]
            });
            const choice = chatResponse.choices[0];
            const imageDescriptionResponse = {
                normalizedText: choice.message.content || null,
                message: {
                    role: 'assistant',
                    content: choice.message.content || '',
                },
                finish_reason: choice.finish_reason || 'stop',
                usage: chatResponse.usage ? {
                    input_tokens: chatResponse.usage.prompt_tokens,
                    output_tokens: chatResponse.usage.completion_tokens,
                    total_tokens: chatResponse.usage.total_tokens,
                    cost: this.calculateCost(chatResponse.usage.prompt_tokens || 0, chatResponse.usage.completion_tokens || 0, IMAGE_DESCRIPTION_MODEL)
                } : undefined
            };
            logger.debug(`Image description generated: ${imageDescriptionResponse.message?.content}${imageDescriptionResponse.usage ? ` (Cost: ${imageDescriptionResponse.usage.cost})` : ''}`);
            return imageDescriptionResponse;
        }
        catch (error) {
            logger.error('Error generating image description:', error);
            throw new Error(`Failed to process image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    calculateCost(inputTokens, outputTokens, model) {
        const pricing = GPT5_PRICING[model];
        const inputCost = (inputTokens / 1_000_000) * pricing.input;
        const outputCost = (outputTokens / 1_000_000) * pricing.output;
        return `$${(inputCost + outputCost).toFixed(6)}`;
    }
}
async function ensureDirectories() {
    if (isDirectoryInitialized)
        return;
    try {
        await fs.promises.mkdir(OUTPUT_PATH, { recursive: true });
        await fs.promises.mkdir(TTS_OUTPUT_PATH, { recursive: true });
        isDirectoryInitialized = true;
    }
    catch (error) {
        logger.error('Failed to create output directories:', error);
        throw new Error('Failed to initialize output directories');
    }
}
//# sourceMappingURL=openaiService.js.map