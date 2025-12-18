/**
 * Public exports for the shared workspace package. This entry-point keeps
 * consumers decoupled from the underlying folder structure so that prompts and
 * registry utilities can evolve without churn in downstream imports.
 */

export type {
  PromptCachePolicy,
  PromptDefinition,
  PromptKey,
  PromptMetadata,
  PromptVariables,
  RenderedPrompt
} from './prompts/promptRegistry.js';

export {
  PromptRegistry,
  getActivePromptRegistry,
  renderPrompt,
  setActivePromptRegistry
} from './prompts/promptRegistry.js';

/**
 * Logging utilities.
 */
export { logger, formatUsd, logLLMCostSummary } from './logger.js';
export type { LLMCostTotals, LLMCostSummaryProvider } from './logger.js';

/**
 * Trace storage utilities for persisting and retrieving response metadata.
 */
export * from './traceStore.js';
export { defaultTraceStore, createTraceStoreFromEnv } from './traceStore.js';
export { SqliteTraceStore } from './sqliteTraceStore.js';

/**
 * Incident storage utilities for durable incident logging and audit trails.
 */
export * from './incidentStore.js';
export { SqliteIncidentStore } from './sqliteIncidentStore.js';
