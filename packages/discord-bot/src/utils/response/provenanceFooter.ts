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
import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

// UI colors for RiskTier levels
const RISK_TIER_COLORS: Record<RiskTier, string> = {
    Low: '#00FF00',     // Green
    Medium: '#FFFF00',  // Yellow
    High: '#FF0000',    // Red
};

// License information to display
const LICENSE_EXPLANATION_URL = 'https://github.com/arete-org/arete/blob/main/LICENSE_STRATEGY.md';
const LICENSE_STRING = `[MIT + HL3](${LICENSE_EXPLANATION_URL})`;

// Footer payload type: Embed plus interactive components (buttons)
type ProvenanceFooterPayload = { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] };

export function buildFooterEmbed(
    riskTier: RiskTier,
    provenance: Provenance,
    confidence: ConfidenceScore,
    citations: Citation[],
    modelVersion: string, // TODO: use specific typing based on allowed model versions
    sessionID: string // TODO: use specific typing when sessionID is defined
): ProvenanceFooterPayload {
    const embed = new EmbedBuilder();

    // RiskTier is reflected in the embed color band
    const riskColor: string = RISK_TIER_COLORS[riskTier] || '#000000';
    if (riskColor == '#000000') {
        console.warn(`Unknown RiskTier: ${riskTier}, defaulting to black color.`);
    }
    embed.setColor(riskColor);

    //
    // Embed content
    //
    // Provenance
    embed.setTitle('Decision Trace'); // friendlier title than just "Provenance"
    embed.setDescription(provenance);

    // Confidence, displayed as a percentage (e.g. "85%")
    if (confidence < 0.0 || confidence > 1.0) {
        console.warn(`Confidence score out of bounds: ${confidence}. Setting to zero.`);
        embed.addField({ name: 'Confidence', value: `0% (err: out of bounds)` });
    } else {
        embed.addField({ name: 'Confidence', value: `${(confidence * 100).toFixed(0)}%` });
    }
    
    // Citations, if any
    // Only list the hostnames with link embedded - the Sources button can be used for more detailed information
    // Discord also shows you the full URL on mouseover
    if (citations.length > 0) {
        const citationLines = citations.map(c => {
            // Extract just the hostname from the URL
            const domain = c.url.hostname.replace('www.', '');
            // Return hostname embedded with url
            return `[${domain}](${c.url})`;
        }).join('\n');
        embed.addField({ name: 'Citations', value: citationLines });
    }

    // Trade-offs
    // TODO
    // described as "a balancing of factors all of which are not attainable at the same time." - Merriam-Webster
    // I'm not certain how this should work yet.
    // Ideally the system surfaces >=1 trade-offs (maybe not always, depending on context)
    // This depends on a system that hasn't been developed yet, using placeholder
    embed.addField({ name: 'Trade-offs', value: 'TODO' });

    // Chain hash
    // TODO
    // This depends on a system that hasn't been developed yet, using placeholder
    embed.addField({ name: 'Chain Hash', value: 'TODO' })

    // License context
    embed.addField({ name: 'License', value: LICENSE_STRING });

    // Footer (model, sessionID, timestamp)
    embed.setFooter({ text: `Model: ${modelVersion} | Response ID: ${sessionID} | ${new Date().toISOString()}` });

    //
    // Interactable Buttons
    //
    const actionRow = new ActionRowBuilder<ButtonBuilder>()

    // Explain button
    const explainButton = new ButtonBuilder()
       .setCustomId('explain')
       .setLabel('Explain')
       .setStyle(ButtonStyle.Primary); // Primary style for emphasis
    actionRow.addComponents(explainButton);

    // Sources button (only if citations exist)
    if (citations.length > 0) {
        const sourcesButton = new ButtonBuilder()
           .setCustomId('sources')
           .setLabel('Sources')
           .setStyle(ButtonStyle.Secondary);
        actionRow.addComponents(sourcesButton);
    }

    // Alternative Lens button
    const altLensButton = new ButtonBuilder()
       .setCustomId('alternative_lens')
       .setLabel('Alternative Lens')
       .setStyle(ButtonStyle.Secondary);
    actionRow.addComponents(altLensButton);

    // Report Issue button
    const reportIssueButton = new ButtonBuilder()
       .setCustomId('report_issue')
       .setLabel('Report Issue')
       .setStyle(ButtonStyle.Danger); // Danger style for emphasis
    actionRow.addComponents(reportIssueButton);

    // Full Trace button
    const fullTraceButton = new ButtonBuilder()
       .setCustomId('full_trace')
       .setLabel('Full Trace')
       .setStyle(ButtonStyle.Link); // Link style for external URL
    actionRow.addComponents(fullTraceButton);

    // TODO: make the buttons do something 
    // (maybe start with an ephemeral "Sorry, that hasn't been implemented yet, but here's what it might look like")
    // This is currently handled in discord-bot/index.ts with interaction.IsButton()
    // We should probably decouple them 

    // Return the ProvenanceFooterPayload - Embed plus interactive components (buttons)
    return { embeds: [embed], components: [actionRow] };
};