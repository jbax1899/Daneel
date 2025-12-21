/**
 * @description Public exports for shared utilities and prompt registry access.
 * @arete-scope interface
 * @arete-module SharedIndex
 * @arete-risk: low - Export changes can break downstream imports.
 * @arete-ethics: low - This module re-exports without processing data.
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
export { logger, formatUsd, logLLMCostSummary, sanitizeLogData } from './logger.js';
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

/**
 * Pseudonymization helpers for Discord-facing identifiers.
 */
export { hmacId, pseudonymizeActorId, pseudonymizeIncidentPointers, shortHash } from './pseudonymization.js';
