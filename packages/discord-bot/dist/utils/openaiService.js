import OpenAI from 'openai';
import { logger } from './logger.js';
export class OpenAIService {
    openai;
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
    }
    async generateResponse(messages, model = 'gpt-4.1-mini', maxTokens = 500) {
        try {
            logger.debug('Sending request to OpenAI');
            const completion = await this.openai.chat.completions.create({
                model,
                messages,
                max_tokens: maxTokens,
            });
            return completion.choices[0]?.message?.content || null;
        }
        catch (error) {
            logger.error('Error in OpenAI service:', error);
            throw error;
        }
    }
    createUserMessage(content) {
        return { role: 'user', content };
    }
    createAssistantMessage(content) {
        return { role: 'assistant', content };
    }
    createSystemMessage(content) {
        return { role: 'system', content };
    }
}
//# sourceMappingURL=openaiService.js.map