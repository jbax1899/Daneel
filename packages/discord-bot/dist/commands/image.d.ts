import { RepliableInteraction } from 'discord.js';
import { Command } from './BaseCommand.js';
import { type ImageGenerationContext } from './image/followUpCache.js';
export interface ImageGenerationSessionResult {
    success: boolean;
    responseId: string | null;
}
/**
 * Runs the end-to-end image generation flow and updates the interaction with
 * progress, results, and a follow-up button when successful.
 */
export declare function runImageGenerationSession(interaction: RepliableInteraction, context: ImageGenerationContext, followUpResponseId?: string | null): Promise<ImageGenerationSessionResult>;
declare const imageCommand: Command;
export default imageCommand;
