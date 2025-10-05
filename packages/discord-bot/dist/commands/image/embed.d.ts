import { EmbedBuilder } from 'discord.js';
export declare function sanitizeForEmbed(value: string): string;
export declare function truncateForEmbed(value: string, limit: number, options?: {
    includeTruncationNote?: boolean;
}): string;
export declare function setEmbedFooterText(embed: EmbedBuilder, text: string): void;
export declare function setEmbedDescription(embed: EmbedBuilder, description: string): void;
export declare function setOrAddEmbedField(embed: EmbedBuilder, name: string, value: string, { inline, includeTruncationNote, maxLength }?: {
    inline?: boolean;
    includeTruncationNote?: boolean;
    maxLength?: number;
}): void;
export interface PromptFieldOptions {
    label: string;
    fullContentUrl?: string;
    whenMissing?: string;
}
export declare function buildPromptFieldValue(value: string | null | undefined, options: PromptFieldOptions): string;
export declare function clampForCloudinary(value: string): string;
export declare function chunkString(value: string, chunkSize: number): string[];
