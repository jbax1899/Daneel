import { Client, GatewayIntentBits, Events } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { EventManager } from './utils/eventManager.js';
import { logger } from './utils/logger.js';
import { config } from './utils/env.js';
// ====================
// Environment Setup
// ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openai = { apiKey: config.openaiApiKey };
// ====================
// Client Configuration
// ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    presence: { status: 'online' }
});
// ====================
// Initialize Managers
// ====================
const commandHandler = new CommandHandler();
const eventManager = new EventManager(client, { openai });
// ====================
// Load and Register Commands
// ====================
try {
    const commands = await commandHandler.loadCommands();
    // Deploy commands to Discord
    await commandHandler.deployCommands(config.token, config.clientId, config.guildId);
    // Store commands in memory for execution
    commands.forEach((cmd, name) => {
        client.commands = client.commands || new Map();
        client.commands.set(name, cmd);
    });
}
catch (error) {
    logger.error('Failed to load/deploy commands:', error);
    process.exit(1);
}
// ====================
// Load Events
// ====================
await eventManager.loadEvents(__dirname + '/events');
eventManager.registerAll();
// ====================
// Start the Bot
// ====================
client.login(config.token);
// ====================
// Process Handlers
// ====================
// Client ready handler
client.once(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user?.tag}`);
});
// Slash commands handler
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    try {
        const command = interaction.client.commands?.get(interaction.commandName);
        if (!command) {
            logger.warn(`No command matching ${interaction.commandName} was found.`);
            return interaction.reply({
                content: 'This command is not available.',
                ephemeral: true
            });
        }
        logger.info(`Executing command: ${interaction.commandName}`);
        return command.execute(interaction);
    }
    catch (error) {
        logger.error(`Error executing ${interaction.commandName}`, error);
        const reply = {
            content: 'There was an error while executing this command!',
            ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(reply);
        }
        else {
            return interaction.reply(reply);
        }
    }
});
// Handle uncaught exceptions
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map