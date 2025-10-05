import { CLOUDINARY_CONTEXT_VALUE_LIMIT, EMBED_DESCRIPTION_LIMIT, EMBED_FIELD_VALUE_LIMIT, EMBED_FOOTER_TEXT_LIMIT, PROMPT_DISPLAY_LIMIT } from './constants.js';
export function sanitizeForEmbed(value) {
    return value.replace(/\u0000/g, '');
}
export function truncateForEmbed(value, limit, options = {}) {
    const sanitized = sanitizeForEmbed(value);
    if (sanitized.length <= limit) {
        return sanitized;
    }
    const ellipsis = '…';
    const truncationNote = options.includeTruncationNote ? '\n*(truncated)*' : '';
    const availableLength = Math.max(0, limit - ellipsis.length - truncationNote.length);
    const truncated = sanitized.slice(0, availableLength);
    return `${truncated}${ellipsis}${truncationNote}`;
}
export function setEmbedFooterText(embed, text) {
    embed.setFooter({ text: truncateForEmbed(text, EMBED_FOOTER_TEXT_LIMIT) });
}
export function setEmbedDescription(embed, description) {
    embed.setDescription(truncateForEmbed(description, EMBED_DESCRIPTION_LIMIT));
}
export function setOrAddEmbedField(embed, name, value, { inline = false, includeTruncationNote = false, maxLength = EMBED_FIELD_VALUE_LIMIT } = {}) {
    const formattedValue = truncateForEmbed(value, maxLength, { includeTruncationNote });
    const field = inline ? { name, value: formattedValue, inline } : { name, value: formattedValue };
    const fields = embed.data.fields ?? [];
    const index = fields.findIndex(existingField => existingField.name === name);
    if (index >= 0) {
        embed.spliceFields(index, 1, field);
    }
    else {
        embed.addFields(field);
    }
}
export function buildPromptFieldValue(value, options) {
    const fallback = options.whenMissing ?? 'None';
    if (!value || !value.trim()) {
        return truncateForEmbed(fallback, EMBED_FIELD_VALUE_LIMIT);
    }
    const sanitized = sanitizeForEmbed(value);
    const exceedsThreshold = sanitized.length > PROMPT_DISPLAY_LIMIT;
    let preview = exceedsThreshold
        ? truncateForEmbed(sanitized, PROMPT_DISPLAY_LIMIT, { includeTruncationNote: true })
        : sanitized;
    if (exceedsThreshold && options.fullContentUrl) {
        // TODO: Add a link to the image on Cloudinary with metadata visible. This currently points to just the image, which is not very useful.
        //preview = `${preview}\n[View full ${options.label}](${options.fullContentUrl})`;
    }
    return truncateForEmbed(preview, EMBED_FIELD_VALUE_LIMIT);
}
export function clampForCloudinary(value) {
    const sanitized = sanitizeForEmbed(value);
    if (sanitized.length <= CLOUDINARY_CONTEXT_VALUE_LIMIT) {
        return sanitized;
    }
    return sanitized.slice(0, CLOUDINARY_CONTEXT_VALUE_LIMIT);
}
export function chunkString(value, chunkSize) {
    const sanitized = sanitizeForEmbed(value);
    if (!sanitized) {
        return [];
    }
    const chunks = [];
    let index = 0;
    while (index < sanitized.length) {
        chunks.push(sanitized.slice(index, index + chunkSize));
        index += chunkSize;
    }
    return chunks;
}
//# sourceMappingURL=embed.js.map