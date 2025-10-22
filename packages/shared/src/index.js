/**
 * Public exports for the shared workspace package. This entry-point keeps
 * consumers decoupled from the underlying folder structure so that prompts and
 * registry utilities can evolve without churn in downstream imports.
 */
export { PromptRegistry, getActivePromptRegistry, renderPrompt, setActivePromptRegistry } from './prompts/promptRegistry.js';
/**
 * Trace storage utilities for persisting and retrieving response metadata.
 */
export { TraceStore, createTraceStore, defaultTraceStore } from './traceStore.js';
//# sourceMappingURL=index.js.map
