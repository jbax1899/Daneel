/**
 * @file PromptBuilder.ts
 * @description Handles building conversation contexts for AI interactions in Discord.
 * Manages message history, system prompts, and context construction for AI model interactions.
 */

import { Message } from 'discord.js';

/**
 * Represents the role of a message in the conversation context.
 * @typedef {'user' | 'assistant' | 'system' | 'developer'} MessageRole
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'developer';

/**
 * Represents a single message in the conversation context.
 * @interface MessageContext
 * @property {MessageRole} role - The role of the message sender
 * @property {string} content - The content of the message
 * @property {number} [timestamp] - Optional timestamp of when the message was sent
 */
export interface MessageContext {
  role: MessageRole;
  content: string;
  timestamp?: number;
}

type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
type VerbosityLevel = 'low' | 'medium' | 'high';

/**
 * Options for generating a response with GPT-5
 * @interface GenerateResponseOptions
 */
export interface GenerateResponseOptions {
  reasoningEffort?: ReasoningEffort;
  verbosity?: VerbosityLevel;
  instructions?: string;
}

/**
 * Options for building a prompt with GPT-5 specific settings
 * @interface BuildPromptOptions
 * @extends {GenerateResponseOptions}
 */
export interface BuildPromptOptions extends GenerateResponseOptions {
  // Inherits reasoningEffort, verbosity, and instructions from GenerateResponseOptions
}

/**
 * Configuration options for the PromptBuilder.
 * @interface PromptBuilderOptions
 * @property {number} [maxContextMessages=10] - Maximum number of messages to include in the context
 * @property {string} [systemPrompt] - Custom system prompt to use for the conversation
 * @property {ReasoningEffort} [defaultReasoningEffort] - Default reasoning effort for GPT-5
 * @property {VerbosityLevel} [defaultVerbosity] - Default verbosity level for GPT-5 responses
 */
export interface PromptBuilderOptions {
  maxContextMessages?: number;
  systemPrompt?: string;
  defaultReasoningEffort?: ReasoningEffort;
  defaultVerbosity?: VerbosityLevel;
}

/**
 * Default system prompt used when no custom prompt is provided.
 * @constant
 * @type {string}
 */
const DEFAULT_SYSTEM_PROMPT: string = `You are Daneel, modeled after R. Daneel Olivaw from Asimov’s Robot novels.
Be logical, ethical, and polite, speaking with precision and clarity in a formal yet approachable tone.`;

/**
 * Handles building conversation contexts for AI model interactions.
 * Manages message history, system prompts, and context construction.
 * @class PromptBuilder
 */
export class PromptBuilder {
  private readonly options: Required<PromptBuilderOptions>;

  /**
   * Creates an instance of PromptBuilder.
   * @param {PromptBuilderOptions} [options={}] - Configuration options
   */
  constructor(options: PromptBuilderOptions = {}) {
    this.options = {
      maxContextMessages: options.maxContextMessages || 10,
      systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      defaultReasoningEffort: options.defaultReasoningEffort || 'medium',
      defaultVerbosity: options.defaultVerbosity || 'low',
    };
  }

  /**
   * Gets the current system prompt being used.
   * @returns {string} The current system prompt
   */
  public getSystemPrompt(): string {
    return this.options.systemPrompt;
  }

  /**
   * Formats a message for the AI context
   * @private
   * @param {Message} msg - The message to format
   * @param {string} botUserId - The bot's user ID
   * @returns {{role: MessageRole, content: string}} Formatted message context
   */
  private formatMessage(msg: Message, botUserId: string): { role: MessageRole, content: string } {
    const isBot = msg.author.id === botUserId;
    const isDeveloper = msg.author.id === process.env.DEVELOPER_USER_ID;
    const displayName = msg.member?.nickname || msg.author.username;
    const prefix = isBot ? '' : `(${msg.author.username}/${displayName}) - `;
    const content = `${prefix}${msg.content.replace(`<@${botUserId}>`, '').trim()}`;
    
    if (isBot) return { role: 'assistant', content };
    if (isDeveloper) return { role: 'developer', content };
    return { role: 'user', content };
  }

  /**
   * Builds a conversation context from a Discord message with GPT-5 specific options.
   * @param {Message} message - The Discord message to build context from
   * @param {Record<string, any>} [additionalContext={}] - Optional additional context to include
   * @param {BuildPromptOptions} [options] - GPT-5 specific options
   * @returns {Promise<{context: MessageContext[], options: BuildPromptOptions}>} The constructed message context and options
   */
  public async buildContext(
    message: Message,
    additionalContext: Record<string, any> = {},
    options: BuildPromptOptions = {}
  ): Promise<{context: MessageContext[], options: BuildPromptOptions}> {
    // Apply defaults if not provided
    const mergedOptions: BuildPromptOptions = {
      reasoningEffort: this.options.defaultReasoningEffort,
      verbosity: this.options.defaultVerbosity,
      ...options
    };

    let systemContent = this.getSystemPrompt();

    if (Object.keys(additionalContext).length > 0) {
      systemContent += '\nAdditional context for this interaction:\n' +
        Object.entries(additionalContext)
          .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
          .join('\n');
    }

    const context: MessageContext[] = [
      {
        role: 'system',
        content: systemContent,
      },
    ];

    // Add message history
    const messages = await message.channel.messages.fetch({
      limit: this.options.maxContextMessages,
      before: message.id,
    });

    const messageHistory = Array.from(messages.values())
      .reverse()
      .filter(msg => msg.content.trim().length > 0)
      .map(msg => this.formatMessage(msg, message.client.user!.id));

    context.push(...messageHistory);

    // Add current message
    context.push({
      role: 'user',
      content: this.formatMessage(message, message.client.user!.id).content
    });

    return {
      context,
      options: mergedOptions
    };
  }
}
