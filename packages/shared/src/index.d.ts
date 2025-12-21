/**
 * @description: Type declarations for shared package exports.
 * @arete-scope interface
 * @arete-module SharedIndexTypes
 * @arete-risk: low - Declaration drift can break downstream type checking.
 * @arete-ethics: low - Types do not change runtime behavior.
 */
export type { PromptCachePolicy, PromptDefinition, PromptKey, PromptMetadata, PromptVariables, RenderedPrompt } from './prompts/promptRegistry.js';
export { PromptRegistry, getActivePromptRegistry, renderPrompt, setActivePromptRegistry } from './prompts/promptRegistry.js';

export { logger, formatUsd, logLLMCostSummary } from './logger.js';
export type { LLMCostTotals, LLMCostSummaryProvider } from './logger.js';
export * from './traceStore.js';
export * from './incidentStore.js';
