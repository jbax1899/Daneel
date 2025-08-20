import { EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
import { logger } from '../logger.js';
// Discord API limits
const MAX_TITLE_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 4096;
const MAX_FIELD_NAME_LENGTH = 256;
const MAX_FIELD_VALUE_LENGTH = 1024;
const MAX_FIELD_COUNT = 25;
export class EmbedBuilder {
    embed;
    fields = [];
    constructor() {
        this.embed = new DiscordEmbedBuilder();
    }
    validateLength(value, maxLength, fieldName) {
        if (value.length > maxLength) {
            logger.warn(`[EmbedBuilder] ${fieldName} exceeds maximum length of ${maxLength} characters`);
            return false;
        }
        return true;
    }
    validateUrl(url, fieldName) {
        try {
            new URL(url);
            return true;
        }
        catch {
            logger.warn(`[EmbedBuilder] Invalid URL provided for ${fieldName}: ${url}`);
            return false;
        }
    }
    // Core Methods
    setTitle(title) {
        if (this.validateLength(title, MAX_TITLE_LENGTH, 'title')) {
            this.embed.setTitle(title);
        }
        return this;
    }
    setDescription(description) {
        if (this.validateLength(description, MAX_DESCRIPTION_LENGTH, 'description')) {
            this.embed.setDescription(description);
        }
        return this;
    }
    setURL(url) {
        if (this.validateUrl(url, 'URL')) {
            this.embed.setURL(url);
        }
        return this;
    }
    setColor(color) {
        try {
            this.embed.setColor(color);
        }
        catch (error) {
            logger.warn(`[EmbedBuilder] Invalid color provided: ${color}`);
        }
        return this;
    }
    // Author
    setAuthor(author) {
        if (!author?.name) {
            logger.warn('[EmbedBuilder] Author name is required');
            return this;
        }
        if (author.iconUrl && !this.validateUrl(author.iconUrl, 'author icon URL')) {
            return this;
        }
        if (author.url && !this.validateUrl(author.url, 'author URL')) {
            return this;
        }
        this.embed.setAuthor({
            name: author.name,
            iconURL: author.iconUrl,
            url: author.url,
        });
        return this;
    }
    // Footer
    setFooter(footer) {
        if (!footer?.text) {
            logger.warn('[EmbedBuilder] Footer text is required');
            return this;
        }
        if (footer.iconUrl && !this.validateUrl(footer.iconUrl, 'footer icon URL')) {
            return this;
        }
        this.embed.setFooter({
            text: footer.text,
            iconURL: footer.iconUrl,
        });
        return this;
    }
    // Image
    setImage(image) {
        if (this.validateUrl(image.url, 'image URL')) {
            this.embed.setImage(image.url);
        }
        return this;
    }
    // Thumbnail
    setThumbnail(thumbnail) {
        if (this.validateUrl(thumbnail.url, 'thumbnail URL')) {
            this.embed.setThumbnail(thumbnail.url);
        }
        return this;
    }
    // Timestamp
    setTimestamp(timestamp = new Date()) {
        this.embed.setTimestamp(timestamp);
        return this;
    }
    // Fields
    addField(field) {
        if (this.fields.length >= MAX_FIELD_COUNT) {
            logger.warn(`[EmbedBuilder] Maximum of ${MAX_FIELD_COUNT} fields reached`);
            return this;
        }
        if (!field.name || !field.value) {
            logger.warn('[EmbedBuilder] Field name and value are required');
            return this;
        }
        const isValidName = this.validateLength(field.name, MAX_FIELD_NAME_LENGTH, 'field name');
        const isValidValue = this.validateLength(field.value, MAX_FIELD_VALUE_LENGTH, 'field value');
        if (isValidName && isValidValue) {
            this.fields.push({
                name: field.name,
                value: field.value,
                inline: field.inline ?? false,
            });
            this.embed.setFields(this.fields);
        }
        return this;
    }
    addFields(...fields) {
        fields.forEach(field => this.addField(field));
        return this;
    }
    addBlankField(inline = false) {
        return this.addField({
            name: '\u200b',
            value: '\u200b',
            inline,
        });
    }
    // Build the final embed
    build() {
        return this.embed;
    }
    /**
     * Converts the embed to a plain JavaScript object.
     * @returns {APIEmbed} The embed data as a plain object
     */
    toJSON() {
        const data = {};
        if (this.embed.data.title)
            data.title = this.embed.data.title;
        if (this.embed.data.description)
            data.description = this.embed.data.description;
        if (this.embed.data.color)
            data.color = this.embed.data.color;
        if (this.embed.data.fields?.length)
            data.fields = [...this.embed.data.fields];
        if (this.embed.data.timestamp)
            data.timestamp = this.embed.data.timestamp;
        if (this.embed.data.thumbnail)
            data.thumbnail = { ...this.embed.data.thumbnail };
        if (this.embed.data.image)
            data.image = { ...this.embed.data.image };
        if (this.embed.data.author)
            data.author = { ...this.embed.data.author };
        if (this.embed.data.footer)
            data.footer = { ...this.embed.data.footer };
        return data;
    }
    // Static methods
    static from(embed) {
        const builder = new EmbedBuilder();
        const discordEmbed = DiscordEmbedBuilder.from(embed);
        builder.embed = discordEmbed;
        if (embed.fields) {
            builder.fields = [...embed.fields];
        }
        return builder;
    }
    // Static factory method for creating embeds with options
    static create({ title, description, color, author, footer, image, thumbnail, fields = [], timestamp = true, } = {}) {
        const embed = new EmbedBuilder();
        if (title)
            embed.setTitle(title);
        if (description)
            embed.setDescription(description);
        if (color)
            embed.setColor(color);
        if (author)
            embed.setAuthor(author);
        if (footer)
            embed.setFooter(footer);
        if (image)
            embed.setImage(image);
        if (thumbnail)
            embed.setThumbnail(thumbnail);
        if (fields.length > 0) {
            // Only add up to MAX_FIELD_COUNT fields
            fields.slice(0, MAX_FIELD_COUNT).forEach(field => embed.addField(field));
        }
        if (timestamp)
            embed.setTimestamp();
        return embed;
    }
}
export default EmbedBuilder;
//# sourceMappingURL=EmbedBuilder.js.map