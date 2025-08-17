import OpenAI from 'openai';
import { logger } from './logger.js';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export class OpenAIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async generateResponse(
    messages: Message[],
    model: string = 'gpt-4.1-mini',
    maxTokens: number = 500
  ): Promise<string | null> {
    try {
      logger.debug('Sending request to OpenAI');
      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      logger.error('Error in OpenAI service:', error);
      throw error;
    }
  }

  createUserMessage(content: string): Message {
    return { role: 'user', content };
  }

  createAssistantMessage(content: string): Message {
    return { role: 'assistant', content };
  }

  createSystemMessage(content: string): Message {
    return { role: 'system', content };
  }
}
