/**
 * Shared helper that converts a requested aspect ratio into the concrete size
 * and label values we use throughout the slash command and automated flows.
 * Centralising this logic prevents drift when Discord options or planner
 * defaults change, and makes future aspect additions straightforward.
 */
export function resolveAspectRatioSettings(aspect) {
    switch (aspect) {
        case 'square':
            return { aspectRatio: 'square', aspectRatioLabel: 'Square', size: '1024x1024' };
        case 'portrait':
            return { aspectRatio: 'portrait', aspectRatioLabel: 'Portrait', size: '1024x1536' };
        case 'landscape':
            return { aspectRatio: 'landscape', aspectRatioLabel: 'Landscape', size: '1536x1024' };
        default:
            return { aspectRatio: 'auto', aspectRatioLabel: 'Auto', size: 'auto' };
    }
}
//# sourceMappingURL=aspect.js.map