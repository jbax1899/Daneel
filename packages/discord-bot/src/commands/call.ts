import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, VoiceChannel, PermissionResolvable, MessageFlags } from 'discord.js';
import { Command } from './BaseCommand.js';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { logger } from '@/utils/logger.js';

/*
* @name call
* @description Have a voice conversation with the AI using Discord's voice features
* @usage /call <voice channel>
* 1. Check if the bot is already in a voice channel (limitation: only one call at a time) - If yes, give the user an error message
* 2. Try to join the voice channel provided - If it fails, give the user an error message
* 3. Invite the user to join the voice channel
* 4. On the target user joining the voice channel, start the call
*/
const callCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('call')
        .setDescription('Have a voice conversation with the AI using Discord\'s voice features')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel to join')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        )
        .addStringOption(option => option // Debug options only available to the bot owner/superuser
            .setName('debug_options')
            .setDescription('Debug options only available to the bot owner/superuser')
            .addChoices(
                { name: 'Exit', value: 'exit' }, // Terminate the voice connection
            )
            .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // Check rate limit per user, channel, and guild
        // Bypass for developer user
        if (interaction.user.id !== process.env.DEVELOPER_USER_ID) {
            // TODO - Implement rate limiter. This is how its done in image.ts
            /*
            const { allowed, retryAfter, error } = imageCommandRateLimiter.checkRateLimitImageCommand(interaction.user.id);
            if (!allowed) {
                const seconds = retryAfter ?? 0;
                const minutes = Math.floor(seconds / 60);
                await interaction.reply({ content: `⚠️ ${error} Try again in ${minutes}m${seconds % 60}s`, ephemeral: true });
                return;
            }
            */

            // We aren't the bot owner/superuser, but we have debug options listed - Give the user an error message
            if (interaction.options.getString('debug_options')) {
                await interaction.reply({ content: 'You do not have permission to use debug options for this command.', ephemeral: true });
                return;
            }
        }

        // If we have debug options, activate them
        if (interaction.options.getString('debug_options')) {
            const debugOption = interaction.options.getString('debug_options');
            switch (debugOption) {
                case 'exit':
                    await interaction.reply({ content: 'Exiting voice connection...', flags: MessageFlags.Ephemeral });
                    try {
                        const voiceConnection = getVoiceConnection(interaction.guild!.id);
                        if (voiceConnection) {
                            voiceConnection.destroy();
                            await interaction.followUp({ content: 'Voice connection exited successfully.', flags: MessageFlags.Ephemeral });
                        }
                        else {
                            await interaction.followUp({ content: 'I was unable to exit the voice connection. I am not in a voice channel.', flags: MessageFlags.Ephemeral });
                        }
                    } catch (error) {
                        logger.error(error);
                        await interaction.followUp({ content: `I was unable to exit the voice connection. Error: ${error}`, flags: MessageFlags.Ephemeral });
                    }
                    return;
            }
        }

        // Check bot permissions before attempting to join
        const botMember = interaction.guild!.members.me!;
        const requiredPermissions = ['Connect', 'UseVAD', 'CreateInstantInvite', 'Speak'];
        const missingPermissions = requiredPermissions.filter( perm => !botMember.permissions.has(perm as PermissionResolvable) );
        if (missingPermissions.length > 0) {
            await interaction.reply({ 
                content: `Missing permissions: ${missingPermissions.join(', ')}\nPlease give me these permissions in your server settings!`, 
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        // Check if the bot is already in a voice channel
        if (botMember.voice.channel) {
            await interaction.reply({ content: 'I am already in a voice channel - Please try again later!', flags: MessageFlags.Ephemeral });
            return;
        }
        
        // Ensure the user provided a valid voice channel
        // TODO: Only list voice channels the bot has access to (currently it lists all voice channels it sees)
        const voiceChannel = interaction.options.getChannel('channel', true, [ChannelType.GuildVoice]) as VoiceChannel;
        if (!voiceChannel) {
            await interaction.reply({ content: 'Please provide a valid voice channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Attempt to join the voice channel
        // https://discord.js.org/docs/packages/voice/0.19.0/CreateVoiceConnectionOptions:Interface
        logger.info(`Attempting to join voice channel: ${voiceChannel.name} (${voiceChannel.id}) in guild: ${interaction.guildId}`);
        let voiceConnection: VoiceConnection;
        try {
            voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId!,
                adapterCreator: interaction.guild!.voiceAdapterCreator
            });

            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 10_000);
            logger.info('Voice connection is ready!');
        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: `I was unable to join the voice channel. Error: ${error}`, flags: MessageFlags.Ephemeral });
            return;
        }

        // Send a message to the user to let them know the bot has joined the voice channel
        await interaction.reply({ content: `I have joined ${voiceChannel.name} - Meet me there!`, flags: MessageFlags.Ephemeral });

        // Invite the user to join the voice channel
        voiceChannel.createInvite()
            .then(invite => {
                interaction.followUp({ content: `Join the call by clicking this link: ${invite.url}`, flags: MessageFlags.Ephemeral });
            })
            .catch(error => {
                logger.error(error);
                interaction.followUp({ content: `I was unable to create an invite for the voice channel. Error: ${error}`, flags: MessageFlags.Ephemeral });
            });

        // Wait 10 seconds, then disconnect
        // TODO: placeholder for now
        setTimeout(() => {
            voiceConnection.destroy();
            logger.info(`Automatically disconnected from ${voiceChannel.name} (${voiceChannel.id}) in guild: ${interaction.guildId}`);
        }, 10_000);

        // Handle disconnects
        // https://discordjs.guide/voice/voice-connections.html#handling-disconnects
        voiceConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            try {
                logger.info(`Voice connection disconnected - trying to reconnect... (${oldState} -> ${newState})`);
                await Promise.race([
                    entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                logger.info('Voice connection reconnected!');
            } catch {
                logger.info('Voice connection disconnected - seems to be a real disconnect which SHOULDN\'T be recovered from');
                voiceConnection.destroy();
            }
        });
    }
};

export default callCommand;