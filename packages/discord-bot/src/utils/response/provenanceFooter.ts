/**
 * Creates a Discord embed to act as a messaage footer with these components:
 * Provenance
 * Citations (if any)
 * Alternative Lens button (rephrase the response with a different perspective)
 * Report Issue button (report incorrect or harmful information)
 * Full Trace button (view the complete reasoning trace)
 * 
 * Embed color band reflects the calculated RiskTier
 * 
 * Uses types from the ethics-core package (ethics-core/src/types.ts)
 */
import { EmbedBuilder } from './EmbedBuilder.js';
import type { RiskTier, Provenance, ConfidenceScore, Citation } from 'ethics-core';

// UI colors for RiskTier levels
const RISK_TIER_COLORS: Record<RiskTier, string> = {
    Low: '#00FF00',     // Green
    Medium: '#FFFF00',  // Yellow
    High: '#FF0000',    // Red
};

export const buildFooterEmbed: (
    riskTier: RiskTier,
    provenance: Provenance,
    confidence: ConfidenceScore,
    citations: Citation[]
) => EmbedBuilder = (
    riskTier: RiskTier,
    provenance: Provenance,
    confidence: ConfidenceScore,
    citations: Citation[]
) => {
    const embed = new EmbedBuilder();

    // RiskTier is reflected in the embed color band
    const riskColor: string = RISK_TIER_COLORS[riskTier] || '#000000';
    if (riskColor == '#000000') {
        console.warn(`Unknown RiskTier: ${riskTier}, defaulting to black color.`);
    }
    embed.setColor(riskColor);

    // First row: Data
    // Provenance
    embed.setTitle('Provenance');
    embed.setDescription(provenance);

    // Confidence, displayed as a percentage (e.g. "85%")
    if (confidence < 0.0 || confidence > 1.0) {
        console.warn(`Confidence score out of bounds: ${confidence}. Setting to zero.`);
        embed.addFields({ name: 'Confidence', value: `0% (err: out of bounds)` });
    } else {
        embed.addFields({ name: 'Confidence', value: `${(confidence * 100).toFixed(0)}%` });
    }
    

    // Citations, if any
    if (citations.length > 0) {
        const citationLines = citations.map(c => {
            const parts = [c.title];
            parts.push(c.url);
            if (c.snippet) parts.push(c.snippet);
            return parts.join(' — ');
        }).join('\n');
        embed.addFields({ name: 'Citations', value: citationLines });
    }

    // Trade-offs
    // TODO

    // Chain hash
    // TODO

    // License context
    // TODO

    // Second row: Interactable Buttons
    // Explain
    // TODO

    // Sources
    // TODO

    // Alternative lens
    // TODO

    // Report Issue
    // TODO

    // Full Trace
    // TODO

    return embed;
};