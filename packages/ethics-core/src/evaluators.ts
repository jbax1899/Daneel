import { Provenance, RiskTier } from './types';

/**
 * Computes the provenance type for a given context.
 * 
 * @param context - Array of recent message strings
 * @returns Provenance type (stub: always "retrieved")
 * 
 * TODO: Implement real logic:
 * - Check if web_search was called
 * - Inspect context length and recency
 * - Detect speculation signals (hedging language, conditional statements)
 */
export function computeProvenance(context: string[]): Provenance {
    // Stub: always return "retrieved" for now
    return "retrieved";
}

/**
 * Computes the risk tier for a given message.
 * 
 * @param content - The message content being evaluated
 * @param context - Array of recent message strings
 * @returns RiskTier classification (stub: always "low")
 * 
 * TODO: Implement real logic:
 * - Apply circuit breaker keyword matching
 * - Check domain heuristics (medical, legal, self-harm)
 * - Analyze sentiment and urgency markers
 */
export function computeRiskTier(content: string, context: string[]): RiskTier {
    // Stub: always return "low" for now
    return "low";
}