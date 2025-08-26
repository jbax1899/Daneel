import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'fs';
import OpenAI from 'openai';
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
    async generateGPT5Response(model, messages, options) {
        const { reasoningEffort = 'low', verbosity = 'low', functions } = options;
        try {
            // Map messages for the OpenAI Responses API
            const input = messages.map(msg => ({
                role: msg.role,
                content: [{
                        type: msg.role === 'assistant' ? 'output_text' : 'input_text',
                        text: msg.content
                    }]
            }));
            const tools = functions?.map(fn => ({
                type: 'function',
                name: fn.name,
                description: fn.description || '',
                parameters: fn.parameters || {},
                strict: false
            }));
            const requestPayload = {
                model,
                input,
                ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
                ...(verbosity && { text: { verbosity } }),
                ...(tools ? { tools } : {}),
                tool_choice: 'auto', // Let the model pick a tool if needed
            };
            // Generate response
            const response = await this.openai.responses.create(requestPayload);
            //logger.debug(`Raw OpenAI response: ${JSON.stringify(response)}`);
            // Get output items from response
            const outputItems = response.output;
            // First try to find a message response
            let outputText = '';
            let finishReason = 'stop';
            for (const item of outputItems ?? []) {
                if (item.type === 'message' && item.content?.[0]?.text) {
                    outputText = item.content[0].text;
                    finishReason = item.finish_reason ?? finishReason;
                    break;
                }
            }
            // Fall back to output_text if no message found
            if (!outputText) {
                const firstTextItem = outputItems.find(i => i.type === 'output_text' && i.content?.[0]?.text?.trim());
                outputText = firstTextItem?.content?.[0]?.text ?? '';
                finishReason = firstTextItem?.finish_reason ?? finishReason;
            }
            let parsedFunctionCall = null;
            for (const item of outputItems ?? []) {
                if (item.type === 'function_call' && item.name) {
                    parsedFunctionCall = { name: item.name, arguments: item.arguments ?? '{}' };
                    break;
                }
            }
            return {
                normalizedText: outputText,
                message: {
                    role: 'assistant',
                    content: outputText,
                    function_call: parsedFunctionCall
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