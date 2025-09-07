import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
export type SlashCommand = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
export interface Command {
    data: SlashCommand;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
