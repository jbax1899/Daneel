/**
 * @description: Builds and executes OpenAI vision requests to describe images for Discord users.
 * @arete-scope: utility
 * @arete-module: ImageDescriptionProcessor
 * @arete-risk: moderate - Failures can block image understanding or inflate costs.
 * @arete-ethics: moderate - Image descriptions may expose sensitive content if mishandled.
 */

import OpenAI from 'openai';
import fetch from 'node-fetch';
import { logger } from '../logger.js';
import { IMAGE_DESCRIPTION_PROMPT_TEMPLATE } from '../../constants/imageProcessing.js';
import type { OpenAIResponse, GPT5ModelType } from '../openaiService.js';

export interface ImageDescriptionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ImageDescriptionResult {
  response: OpenAIResponse;
  usage: ImageDescriptionUsage | null;
}

export interface ImageDescriptionRequest {
  imageUrl: string;
  context?: string;
  model: GPT5ModelType;
}

const DEFAULT_CONTENT_TYPE = 'image/jpeg';

/**
 * Build the prompt by inserting the optional context while preserving the
 * canonical prompt text in constants.
 */
function buildImageDescriptionPrompt(context?: string): string {
  const trimmedContext = context?.trim();
  const normalizedContext = trimmedContext && trimmedContext.length > 0 ? trimmedContext : '(none)';
  const contextBlock = trimmedContext && trimmedContext.length > 0
    ? `Additional context: ${trimmedContext}`
    : '';

  return IMAGE_DESCRIPTION_PROMPT_TEMPLATE
    .replace('{{context}}', normalizedContext)
    .replace('{{context_block}}', contextBlock);
}

/**
 * Download and base64-encode an image so it can be sent to the vision API.
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64Image: string; contentType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const imageBuffer = await response.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString('base64');
  const contentType = response.headers.get('content-type') || DEFAULT_CONTENT_TYPE;

  logger.debug('Downloaded image for description', {
    imageUrl,
    contentType,
    byteLength: imageBuffer.byteLength
  });

  return { base64Image, contentType };
}

/**
 * Execute the vision request and normalize the OpenAI response into the shared
 * OpenAIResponse format used across the bot.
 */
export async function generateImageDescriptionRequest(
  openai: OpenAI,
  request: ImageDescriptionRequest
): Promise<ImageDescriptionResult> {
  const { imageUrl, context, model } = request;
  const { base64Image, contentType } = await fetchImageAsBase64(imageUrl);
  const prompt = buildImageDescriptionPrompt(context);

  const chatResponse = await openai.chat.completions.create({
    model,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt
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
  const imageDescriptionResponse: OpenAIResponse = {
    normalizedText: choice.message.content || null,
    message: {
      role: 'assistant',
      content: choice.message.content || ''
    },
    finish_reason: choice.finish_reason || 'stop',
    usage: chatResponse.usage ? {
      input_tokens: chatResponse.usage.prompt_tokens || 0,
      output_tokens: chatResponse.usage.completion_tokens || 0,
      total_tokens: chatResponse.usage.total_tokens ?? 0
    } : undefined
  };

  return {
    response: imageDescriptionResponse,
    usage: chatResponse.usage ? {
      promptTokens: chatResponse.usage.prompt_tokens || 0,
      completionTokens: chatResponse.usage.completion_tokens || 0,
      totalTokens: chatResponse.usage.total_tokens ?? 0
    } : null
  };
}
