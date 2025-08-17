type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};
export declare class OpenAIService {
    private openai;
    constructor(apiKey: string);
    generateResponse(messages: Message[], model?: string, maxTokens?: number): Promise<string | null>;
    createUserMessage(content: string): Message;
    createAssistantMessage(content: string): Message;
    createSystemMessage(content: string): Message;
}
export {};
