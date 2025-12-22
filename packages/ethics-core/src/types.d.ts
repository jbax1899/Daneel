/**
 * @description: Declares ethics-core public types for provenance and risk tiers.
 * @arete-scope interface
 * @arete-module EthicsCoreTypes
 * @arete-risk: low - Type drift can break downstream tooling or UI mappings.
 * @arete-ethics: low - Types document semantics without processing data.
 */
/**
 * RiskTier classifies the sensitivity of a response.
 * - low: General knowledge, casual topics
 * - medium: Nuanced advice, education, workplace
 * - high: Sensitive topics near circuit-breaker thresholds
 * Includes standard colors for UI representation.
 */
export type RiskTier = "Low" | "Medium" | "High";
/**
 * Provenance indicates the epistemic origin of a response.
 * - retrieved: Grounded in external sources (web search, documents)
 * - inferred: Logical deduction from context
 * - speculative: Educated guess (lower confidence)
 */
export type Provenance = "Retrieved" | "Inferred" | "Speculative";
/**
 * Calculated confidence score (0.0–1.0) reflects the system's certainty
 * about the accuracy and reliability of the response.
 */
export type ConfidenceScore = number;
/**
 * Citation represents a source used in the response.
 */
export type Citation = {
    title: string;
    url: URL;
    snippet?: string;
};
/**
 * The complete provenance package for a response.
 */
export type ResponseMetadata = {
    responseId: string;
    provenance: Provenance;
    confidence: ConfidenceScore;
    riskTier: RiskTier;
    tradeoffCount: number;
    chainHash: string;
    licenseContext: string;
    modelVersion: string;
    staleAfter: string;
    citations: Citation[];
    imageDescriptions?: string[];
};
