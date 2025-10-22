/**
 * Local ambient declarations for @arete/shared to keep the Discord bot happy when building from source.
 * Keep this file in sync with the package's public surface area.
 */
declare module '@arete/shared' {
  import type { ResponseMetadata } from 'ethics-core';

  export type PromptKey =
    | 'discord.chat.system'
    | 'discord.image.system'
    | 'discord.image.developer'
    | 'discord.realtime.system'
    | 'discord.planner.system'
    | 'discord.summarizer.system'
    | 'discord.news.system';

  export interface PromptCachePolicy {
    strategy?: string;
    ttlSeconds?: number;
    [key: string]: unknown;
  }

  export interface PromptMetadata {
    description?: string;
    cache?: PromptCachePolicy;
  }

  export interface PromptDefinition extends PromptMetadata {
    template: string;
  }

  export type PromptVariables = Record<string, string | number | boolean | null | undefined>;

  export interface RenderedPrompt extends PromptMetadata {
    content: string;
  }

  export interface PromptRegistryOptions {
    overridePath?: string;
  }

  export class PromptRegistry {
    constructor(options?: PromptRegistryOptions);
    getPrompt(key: PromptKey): PromptDefinition;
    renderPrompt(key: PromptKey, variables?: PromptVariables): RenderedPrompt;
    hasPrompt(key: PromptKey): boolean;
    assertKeys(keys: PromptKey[]): void;
  }

  export function renderPrompt(key: PromptKey, variables?: PromptVariables): RenderedPrompt;

  export function setActivePromptRegistry(registry: PromptRegistry): void;

  export function getActivePromptRegistry(): PromptRegistry;

  // Trace store helpers mirror the shared package so consumers can persist provenance data.
  export interface TraceStoreConfig {
    /**
     * Directory where response metadata traces will be written and read from.
     */
    storagePath: string;
  }

  export class TraceStore {
    private readonly config: TraceStoreConfig;

    /**
     * @param config Describes where trace files are stored on disk.
     */
    constructor(config: TraceStoreConfig);

    /**
     * Ensures the storage directory exists prior to writing.
     */
    private ensureStorageDirectory;

    /**
     * Resolves the file path for a given response identifier.
     * @throws {Error} If the responseId contains unsupported characters.
     */
    private getFilePath;

    /**
     * Inserts or updates the persisted metadata for a response.
     * Employs per-response advisory lock files (with a two minute staleness threshold) to
     * serialize concurrent writers before performing an atomic temp-file rename.
     * @param metadata Metadata to persist.
     * @throws {Error} When the filesystem operation fails.
     */
    upsert(metadata: ResponseMetadata): Promise<void>;

    /**
     * Retrieves persisted metadata for a response.
     * @param responseId Identifier used when the metadata was stored.
     * @returns The stored metadata, or null when no file exists.
     * @throws {Error} When the file contents are corrupt or the read fails unexpectedly.
     */
    retrieve(responseId: string): Promise<ResponseMetadata | null>;

    /**
     * Removes the stored metadata for a response if it exists.
     * Deletion failures are logged but do not throw to keep call-sites resilient.
     * @param responseId Identifier whose metadata should be deleted.
     */
    delete(responseId: string): Promise<void>;
  }

  /**
   * Creates a new trace store instance with optional configuration overrides.
   * @param config Custom configuration for the store; defaults to a traces directory in cwd.
   */
  export function createTraceStore(config?: TraceStoreConfig): TraceStore;

  /**
   * Default trace store instance using environment configuration.
   */
  export const defaultTraceStore: TraceStore;
}
