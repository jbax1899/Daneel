/**
 * @description: Type declarations for prompt registry contracts.
 * @arete-scope interface
 * @arete-module PromptRegistryTypes
 * @arete-risk: low - Type drift can break prompt consumers or tooling.
 * @arete-ethics: low - Types document prompt structure without processing data.
 */
/**
 * Literal union of every prompt key currently supported. Keeping this list
 * centrally defined ensures compile-time safety for all consumers.
 */
export type PromptKey = 'discord.chat.system' | 'discord.image.system' | 'discord.image.developer' | 'discord.realtime.system' | 'discord.planner.system' | 'discord.summarizer.system' | 'discord.news.system';
/**
 * Tracks metadata used by downstream systems (for example cache hints). The
 * structure intentionally remains flexible so that future policies can be added
 * without needing to cascade type updates throughout the repo.
 */
export interface PromptCachePolicy {
    strategy?: string;
    ttlSeconds?: number;
    [key: string]: unknown;
}
/**
 * Canonical description of a prompt entry once loaded from YAML.
 */
export interface PromptMetadata {
    description?: string;
    cache?: PromptCachePolicy;
}
export interface PromptDefinition extends PromptMetadata {
    template: string;
}
/**
 * Variables that may be interpolated into prompt templates. All values are
 * coerced to strings, with `null`/`undefined` becoming an empty string.
 */
export type PromptVariables = Record<string, string | number | boolean | null | undefined>;
/**
 * Result returned after interpolation. Keeping the metadata available allows
 * callers to forward cache hints alongside the resolved prompt body.
 */
export interface RenderedPrompt extends PromptMetadata {
    content: string;
}
export interface PromptRegistryOptions {
    /** Optional override file path, typically driven by the PROMPT_CONFIG_PATH env var. */
    overridePath?: string;
}
/**
 * PromptRegistry is the single source of truth for loading, merging, and
 * retrieving prompt templates. It understands both the built-in defaults and an
 * optional operator-supplied override file.
 */
export declare class PromptRegistry {
    private readonly prompts;
    constructor(options?: PromptRegistryOptions);
    /**
     * Retrieves a prompt definition or throws a descriptive error if missing.
     */
    getPrompt(key: PromptKey): PromptDefinition;
    /**
     * Convenience wrapper that resolves a prompt and performs interpolation.
     */
    renderPrompt(key: PromptKey, variables?: PromptVariables): RenderedPrompt;
    /**
     * Indicates whether a prompt is defined. Useful for lightweight startup
     * assertions without forcing interpolation.
     */
    hasPrompt(key: PromptKey): boolean;
    /**
     * Ensures that each requested key has a corresponding definition. This is
     * handy for startup checks so operators immediately know if their overrides
     * omitted any critical prompts.
     */
    assertKeys(keys: PromptKey[]): void;
    /**
     * Loads and flattens a YAML prompt file into the internal map representation.
     */
    private loadPromptFile;
    /**
     * Recursively walks a nested object structure, producing dot-delimited keys
     * that match the PromptKey union.
     */
    private flattenPromptTree;
}
/**
 * Registers the singleton prompt registry for downstream helpers. Typically
 * invoked from the Discord bot's environment bootstrap after loading overrides.
 */
export declare const setActivePromptRegistry: (registry: PromptRegistry) => void;
/**
 * Retrieves the currently configured registry or throws a helpful error when
 * it has not yet been initialised.
 */
export declare const getActivePromptRegistry: () => PromptRegistry;
/**
 * Convenience wrapper preferred by many call-sites. It simply defers to the
 * configured registry while keeping metadata in the response.
 */
export declare const renderPrompt: (key: PromptKey, variables?: PromptVariables) => RenderedPrompt;
