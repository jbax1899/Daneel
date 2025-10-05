import { APIEmbed, ColorResolvable, EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
type RGB = [number, number, number];
type HexColor = `#${string}`;
export type EmbedColor = ColorResolvable | RGB | HexColor | number | string;
export interface EmbedAuthorOptions {
    name: string;
    iconUrl?: string;
    url?: string;
}
export interface EmbedFieldOptions {
    name: string;
    value: string;
    inline?: boolean;
}
export interface EmbedFooterOptions {
    text: string;
    iconUrl?: string;
}
export interface EmbedImageOptions {
    url: string;
    height?: number;
    width?: number;
}
export interface EmbedThumbnailOptions {
    url: string;
    height?: number;
    width?: number;
}
export declare class EmbedBuilder {
    private embed;
    private fields;
    constructor();
    private validateLength;
    private validateUrl;
    setTitle(title: string): this;
    setDescription(description: string): this;
    setURL(url: string): this;
    setColor(color: EmbedColor): this;
    setAuthor(author: EmbedAuthorOptions): this;
    setFooter(footer: EmbedFooterOptions): this;
    setImage(image: EmbedImageOptions): this;
    setThumbnail(thumbnail: EmbedThumbnailOptions): this;
    setTimestamp(timestamp?: number | Date | null): this;
    addField(field: EmbedFieldOptions): this;
    addFields(...fields: EmbedFieldOptions[]): this;
    addBlankField(inline?: boolean): this;
    build(): DiscordEmbedBuilder;
    /**
     * Converts the embed to a plain JavaScript object.
     * @returns {APIEmbed} The embed data as a plain object
     */
    toJSON(): APIEmbed;
    static from(embed: APIEmbed): EmbedBuilder;
    static create({ title, description, color, author, footer, image, thumbnail, fields, timestamp, }?: {
        title?: string;
        description?: string;
        color?: EmbedColor;
        author?: EmbedAuthorOptions;
        footer?: EmbedFooterOptions;
        image?: EmbedImageOptions;
        thumbnail?: EmbedThumbnailOptions;
        fields?: EmbedFieldOptions[];
        timestamp?: boolean;
    }): EmbedBuilder;
}
export default EmbedBuilder;
