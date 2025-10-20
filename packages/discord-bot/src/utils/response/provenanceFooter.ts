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
    const riskColor: string = riskTier.color || '#000000';
    embed.setColor(riskColor);

    // First row: Data
    // Provenance
    embed.setTitle('Provenance');
    embed.setDescription(provenance);

    // Confidence
    embed.addFields({ name: 'Confidence', value: `${(confidence * 100).toFixed(0)}%` }); // Display confidence as a percentage (e.g. "85%")

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