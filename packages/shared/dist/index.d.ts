/**
 * Public exports for the shared workspace package. This entry-point keeps
 * consumers decoupled from the underlying folder structure so that prompts and
 * registry utilities can evolve without churn in downstream imports.
 */
export type { PromptCachePolicy, PromptDefinition, PromptKey, PromptMetadata, PromptVariables, RenderedPrompt } from './prompts/promptRegistry.js';
export { PromptRegistry, getActivePromptRegistry, renderPrompt, setActivePromptRegistry } from './prompts/promptRegistry.js';
