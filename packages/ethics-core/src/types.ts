/**
 * Provenance indicates the epistemic origin of a response.
 * - retrieved: Grounded in external sources (web search, documents)
 * - inferred: Logical deduction from context
 * - speculative: Educated guess (lower confidence)
 */
export type Provenance = "retrieved" | "inferred" | "speculative";

/**
 * RiskTier classifies the sensitivity of a response.
 * - low: General knowledge, casual topics
 * - medium: Nuanced advice, education, workplace
 * - high: Sensitive topics near circuit-breaker thresholds
 */
export type RiskTier = "low" | "medium" | "high";

/**
 * Citation represents a source used in the response.
 */
export interface Citation {
    title: string;
    url: string;
    snippet?: string; // Optional excerpt from source
}

/**
 * The complete provenance package for a response.
 */
export interface ResponseMetadata {
    responseId: string;           // Unique short ID (e.g., "7K3A")
    provenance: Provenance;       // Epistemic origin
    confidence: number;           // 0.0–1.0 confidence
    riskTier: RiskTier;           // Sensitivity classification
    tradeoffCount: number;        // Number of competing values surfaced
    chainHash: string;            // Cryptographic hash of reasoning chain
    licenseContext: string;       // e.g., "MIT + HL3"
    modelVersion: string;         // e.g., "gpt-4.1-mini"
    staleAfter: string;           // ISO 8601 timestamp
    citations: Citation[];        // Sources consulted
}