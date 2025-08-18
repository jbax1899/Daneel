/**
 * @file PromptBuilder.ts
 * @description Handles building conversation contexts for AI interactions in Discord.
 * Manages message history, system prompts, and context construction for AI model interactions.
 */

import { Message } from 'discord.js';

/**
 * Represents the role of a message in the conversation context.
 * @typedef {'user' | 'assistant' | 'system'} MessageRole
 */
export type MessageRole = 'user' | 'assistant' | 'system';

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

/**
 * Configuration options for the PromptBuilder.
 * @interface PromptBuilderOptions
 * @property {number} [maxContextMessages=10] - Maximum number of messages to include in the context
 * @property {string} [systemPrompt] - Custom system prompt to use for the conversation
 */
export interface PromptBuilderOptions {
  maxContextMessages?: number;
  systemPrompt?: string;
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
   * Builds a conversation context from a Discord message.
   * @param {Message} message - The Discord message to build context from
   * @param {Record<string, any>} [additionalContext={}] - Optional additional context to include
   * @returns {Promise<MessageContext[]>} Array of message contexts for the AI model
   */
  public async buildContext(
    message: Message,
    additionalContext: Record<string, any> = {}
  ): Promise<MessageContext[]> {
    let systemContent = this.getSystemPrompt(); // Create system message with both default prompt and additional context

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
      .map(msg => {
        const isBot = msg.author.id === message.client.user?.id;
        const displayName = msg.member?.nickname || msg.author.username;
        const prefix = isBot ? '' : `(${msg.author.username}/${displayName}) - `;
        return {
          role: (isBot ? 'assistant' : 'user') as MessageRole,
          content: `${prefix}${msg.content.replace(`<@${message.client.user?.id}>`, '').trim()}`,
        };
      });

    context.push(...messageHistory);

    // Add current message
    context.push({
      role: 'user',
      content: message.content.trim()
    });

    return context;
  }
}
