import { OpenAI } from 'openai';
import type {
    Response,
    ResponseInput,
    Tool,
    ToolChoiceTypes
} from 'openai/resources/responses/responses.js';
import { logger } from '../../utils/logger.js';
import {
    PARTIAL_IMAGE_LIMIT,
    REFLECTION_DESCRIPTION_LIMIT,
    REFLECTION_MESSAGE_LIMIT,
    REFLECTION_TITLE_LIMIT
} from './constants.js';
import { sanitizeForEmbed, truncateForEmbed } from './embed.js';
import { buildDeveloperPrompt, IMAGE_SYSTEM_PROMPT } from './prompts.js';
import type {
    ImageBackgroundType,
    ImageGenerationCallWithPrompt,
    ImageQualityType,
    ImageRenderModel,
    ImageSizeType,
    ImageStylePreset,
    ImageTextModel,
    PartialImagePayload,
    ReflectionFields
} from './types.js';
import { mapResponseError } from './errors.js';

interface GenerateImageOptions {
    openai: OpenAI;
    prompt: string;
    textModel: ImageTextModel;
    imageModel: ImageRenderModel;
    quality: ImageQualityType;
    size: ImageSizeType;
    background: ImageBackgroundType;
    style: ImageStylePreset;
    username: string;
    nickname: string;
    guildName: string;
    allowPromptAdjustment: boolean;
    followUpResponseId?: string | null;
    onPartialImage?: (payload: PartialImagePayload) => Promise<void> | void;
}

interface GenerationOutcome {
    response: Response;
    imageCall: ImageGenerationCallWithPrompt;
    finalImageBase64: string;
    partialImages: string[];
    reflection: ReflectionFields;
}

export async function generateImageWithReflection(options: GenerateImageOptions): Promise<GenerationOutcome> {
    const {
        openai,
        prompt,
        textModel,
        imageModel,
        quality,
        size,
        background,
        style,
        allowPromptAdjustment,
        followUpResponseId,
        username,
        nickname,
        guildName,
        onPartialImage
    } = options;

    const input: ResponseInput = [
        {
            role: 'system',
            type: 'message',
            content: [{ type: 'input_text', text: IMAGE_SYSTEM_PROMPT }]
        },
        {
            role: 'developer',
            type: 'message',
            content: [{ type: 'input_text', text: buildDeveloperPrompt({
                allowPromptAdjustment,
                size,
                quality,
                background,
                style,
                username,
                nickname,
                guildName
            }) }]
        },
        {
            role: 'user',
            type: 'message',
            content: [{ type: 'input_text', text: prompt }]
        }
    ];

    const imageTool = createImageGenerationTool({
        model: imageModel,
        quality,
        size,
        background
    });

    const toolChoice: ToolChoiceTypes = { type: 'image_generation' };

    const requestPayload = {
        model: textModel,
        input,
        tools: [imageTool],
        tool_choice: toolChoice,
        previous_response_id: followUpResponseId ?? null,
        stream: true as const
    };

    logger.debug(`Request payload: ${JSON.stringify(requestPayload, null, 2)}`);

    const partialImages: string[] = [];

    const stream = await openai.responses.stream(requestPayload);

    stream.on('response.image_generation_call.partial_image', event => {
        try {
            partialImages[event.partial_image_index] = event.partial_image_b64;
            if (onPartialImage) {
                void Promise.resolve(onPartialImage({ index: event.partial_image_index, base64: event.partial_image_b64 }))
                    .catch(error => logger.warn('Failed to process partial image update:', error));
            }
        } catch (error) {
            logger.warn('Unexpected error while handling partial image:', error);
        }
    });

    stream.on('error', (error: unknown) => {
        logger.error('Image generation stream error:', error);
    });

    stream.on('response.failed', event => {
        logger.error('Image generation stream failed:', event.response.error ?? event.response);
    });

    const response = await stream.finalResponse();

    if (response.error) {
        throw new Error(mapResponseError(response.error));
    }

    const imageGenerationCalls = response.output.filter(
        (output): output is ImageGenerationCallWithPrompt => output.type === 'image_generation_call'
    );

    if (imageGenerationCalls.length === 0) {
        throw new Error('No image generation call found in response. The model may not have decided to generate an image.');
    }

    const imageCallWithResult = imageGenerationCalls.find(call => Boolean(call.result));
    const imageCall = imageCallWithResult ?? imageGenerationCalls[0];
    const imageData = normalizeImageResult(imageCall?.result);

    if (!imageCall || !imageData) {
        throw new Error('No image data found in the image generation call result.');
    }

    logger.debug(`Image generation successful - ID: ${imageCall.id}, Status: ${imageCall.status}`);

    const reflectionText = extractFirstTextMessage(response);
    const reflection = parseReflectionFields(reflectionText);

    return {
        response,
        imageCall,
        finalImageBase64: imageData,
        partialImages,
        reflection
    };
}

function createImageGenerationTool(options: {
    model: ImageRenderModel;
    quality: ImageQualityType;
    size: ImageSizeType;
    background: ImageBackgroundType;
}): Tool.ImageGeneration {
    // The OpenAI SDK types sometimes omit the optional `model` field. We widen
    // the type locally so that downstream code always receives a populated
    // value without having to repeat the cast at each call-site.
    const tool: Tool.ImageGeneration & { model?: string } = {
        type: 'image_generation',
        quality: options.quality,
        size: options.size,
        background: options.background,
        partial_images: PARTIAL_IMAGE_LIMIT
    };
    tool.model = options.model;
    return tool;
}

function normalizeImageResult(result: unknown): string | null {
    if (!result) {
        return null;
    }

    if (typeof result === 'string') {
        return result;
    }

    if (typeof result === 'object') {
        const possible = result as Record<string, unknown>;
        const keys = ['b64_json', 'image_b64', 'base64'];
        for (const key of keys) {
            const value = possible[key];
            if (typeof value === 'string') {
                return value;
            }
        }
    }

    return null;
}

function extractFirstTextMessage(response: Response): string | null {
    for (const output of response.output ?? []) {
        if (output.type !== 'message') {
            continue;
        }

        for (const content of output.content ?? []) {
            if (content.type === 'output_text' && content.text) {
                return content.text;
            }
        }
    }
    return null;
}

function stripJsonFences(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
        const inner = trimmed.replace(/^```json\s*/i, '').replace(/```$/i, '');
        return inner.trim();
    }
    return trimmed;
}

function parseReflectionFields(rawText: string | null): ReflectionFields {
    if (!rawText) {
        return { title: null, description: null, reflection: null, adjustedPrompt: null };
    }

    const sanitizedRaw = stripJsonFences(rawText);

    try {
        const parsed = JSON.parse(sanitizedRaw) as Partial<ReflectionFields> & { adjusted_prompt?: string };
        const title = parsed.title ? truncateForEmbed(sanitizeForEmbed(parsed.title), REFLECTION_TITLE_LIMIT) : null;
        const description = parsed.description
            ? truncateForEmbed(sanitizeForEmbed(parsed.description), REFLECTION_DESCRIPTION_LIMIT)
            : null;
        const reflection = parsed.reflection
            ? truncateForEmbed(sanitizeForEmbed(parsed.reflection), REFLECTION_MESSAGE_LIMIT)
            : null;
        const adjustedPrompt = parsed.adjusted_prompt ?? parsed.adjustedPrompt ?? null;

        return { title, description, reflection, adjustedPrompt };
    } catch (error) {
        logger.warn('Failed to parse reflection response JSON. Using raw text.', error);
        const reflection = truncateForEmbed(sanitizeForEmbed(sanitizedRaw), REFLECTION_MESSAGE_LIMIT);
        return { title: null, description: null, reflection, adjustedPrompt: null };
    }
}
