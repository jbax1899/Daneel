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
  export class SqliteTraceStore {
    constructor(config: { dbPath: string });
    upsert(metadata: ResponseMetadata): Promise<void>;
    retrieve(responseId: string): Promise<ResponseMetadata | null>;
    delete(responseId: string): Promise<void>;
  }

  export type TraceStore = SqliteTraceStore;

  /**
   * Default trace store instance using environment configuration.
   */
  export function createTraceStoreFromEnv(): TraceStore;
  export const defaultTraceStore: TraceStore;
}
