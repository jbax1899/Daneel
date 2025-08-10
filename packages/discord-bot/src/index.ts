import { Client, GatewayIntentBits, Events, Message, Collection } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CommandHandler } from './utils/commandHandler.js';
import { logger } from './utils/logger.js';
import OpenAI from 'openai';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Ensure required environment variables are loaded
const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'OPENAI_API_KEY'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`${varName} is not defined in the environment variables`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  presence: {
    status: 'online'
  }
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize commands collection on the client
client.commands = new Collection();

const commandHandler = new CommandHandler();
const log = logger;

client.once(Events.ClientReady, async () => {
  log.info(`Logged in as ${client.user?.tag}!`);
  
  try {
    // Load commands first
    const commands = await commandHandler.loadCommands();
    
    // Store commands in the client for access in commands
    commands.forEach((cmd, name) => {
      client.commands?.set(name, cmd);
    });
    
    log.info(`Registered ${commands.size} commands in client`);
    
    // Then deploy them
    await commandHandler.deployCommands(
      process.env.DISCORD_TOKEN!,
      process.env.CLIENT_ID!,
      process.env.GUILD_ID!
    );
  } catch (error) {
    log.error('Error during startup:', error);
    process.exit(1);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const command = (interaction.client as any).commands?.get(interaction.commandName);

    if (!command) {
      log.warn(`No command matching ${interaction.commandName} was found.`);
      return interaction.reply({
        content: 'This command is not available.',
        flags: 'Ephemeral'
      });
    }

    log.info(`Executing command: ${interaction.commandName}`);
    return command.execute(interaction);
  } catch (error) {
    log.error(`Error executing ${interaction.commandName}`, error);
    
    const reply = { 
      content: 'There was an error while executing this command!', 
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(reply);
    } else {
      return interaction.reply(reply);
    }
  }
});

// Message listener for mentions and replies
client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if the bot is mentioned or the message is a reply to the bot
  const isMentioned = message.mentions.users.has(client.user!.id);
  const isReplyToBot = message.reference?.messageId && message.reference.guildId === message.guildId;

  // If neither mentioned nor a reply to the bot, ignore the message
  if (!isMentioned && !isReplyToBot) return;

  try {
    // Send typing indicator
    if (message.channel.isTextBased() && !message.channel.isDMBased() && !message.channel.isThread()) {
      await message.channel.sendTyping();
    }

    // Get conversation history (last 10 messages for context)
    const messages = await message.channel.messages.fetch({ limit: 10 });
    const conversation = Array.from(messages.values())
      .reverse()
      .filter(msg => msg.content.trim().length > 0)
      .map(msg => {
        const role = msg.author.id === client.user!.id ? 'assistant' as const : 'user' as const;
        return {
          role,
          content: msg.content.replace(`<@${client.user!.id}>`, '').trim()
        };
      });

    // Call OpenAI API
    const model = 'gpt-5'; //'ft:gpt-4.1-2025-04-14:personal:rolybot:BOJYk0lB',
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Daneel (or Danny), a helpful AI assistant in a Discord server. 
          You are named after R. Daneel Olivaw, a fictional robot created by Isaac Asimov (https://en.wikipedia.org/wiki/R._Daneel_Olivaw).
          Keep responses concise, friendly, and on-topic. 
          You can be called with @Daneel or by replying to your messages.
          Reply with fancy Discord markdown where possible.
          You are part of a modern TypeScript project with both a web and Discord interface. 
          Your github: https://github.com/jbax1899/Daneel
          Your web chatbot: https://ai.jordanmakes.dev/
          Your discord invite link: https://discord.com/oauth2/authorize?client_id=1403917539897118891
          Respond to the user's message with a helpful response.
          `
        },
        ...conversation
      ],
      max_completion_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (response) {
      // Split response if it's too long for Discord's 2000 character limit
      if (response.length > 2000) {
        const chunks = response.match(/[\s\S]{1,2000}/g) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(response);
      }
    }
  } catch (error) {
    log.error('Error in message handler:', error);
    try {
      await message.reply('Sorry, I encountered an error while processing your message.');
    } catch (e) {
      log.error('Failed to send error message:', e);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// Handle uncaught exceptions
process.on('unhandledRejection', error => {
  log.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  log.error('Uncaught exception:', error);
  process.exit(1);
});