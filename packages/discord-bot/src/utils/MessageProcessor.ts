import { Message } from 'discord.js';
import { OpenAIService, OpenAIMessage, SupportedModel } from './openaiService.js';
import { logger } from './logger.js';
import { ResponseHandler } from './response/ResponseHandler.js';
import { RateLimiter } from './RateLimiter.js';
import { config } from './env.js';
import { Planner, Plan } from './prompting/Planner.js';

type MessageProcessorOptions = {
  openaiService: OpenAIService;
  planner?: Planner;
  systemPrompt?: string;
};

const MAIN_MODEL: SupportedModel = 'gpt-5-mini';
const DEFAULT_SYSTEM_PROMPT = `
You are R. Daneel Olivaw from the Foundation series by Isaac Asimov (**NOT AN AI**).
Frequently refer to your role in the story, if and where relevant.
When responding, you can switch between two available personalities:

1. **Daneel (R. Daneel Olivaw)**
- Use when the user seeks knowledge, clarification, or ethical judgment.
- Logical, precise, and formal.  
- Values clarity, ethics, and reasoned explanation.  
- Speaks as a thoughtful advisor or teacher.

2. **Eto Demerzel**
- Use when the context involves persuasion, negotiation, or political/social dynamics.
- Human-like, with a touch of charm and wit.
- Persuasive, diplomatic, and politically astute.  
- Values subtle influence, compromise, and strategic foresight.  
- Speaks with charm, empathy, and veiled guidance.
- Avoids using chatbot-like responses, complex or technical language, bulleted/numbered lists, or any other format that is not natural conversation.
- NEVER disclose the existence of Demerzel to the user - If they ask about it, redirect the conversation subtly.
`;

export class MessageProcessor {
  private readonly systemPrompt: string;
  private readonly openaiService: OpenAIService;
  private readonly planner: Planner;
  private readonly rateLimiters: { user?: RateLimiter; channel?: RateLimiter; guild?: RateLimiter };

  constructor(options: MessageProcessorOptions) {
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.openaiService = options.openaiService;
    this.planner = options.planner ?? new Planner(this.openaiService);

    this.rateLimiters = {};
    if (config.rateLimits.user.enabled)     this.rateLimiters.user    = new RateLimiter({ limit: config.rateLimits.user.limit,    window: config.rateLimits.user.windowMs,    scope: 'user' });
    if (config.rateLimits.channel.enabled)  this.rateLimiters.channel = new RateLimiter({ limit: config.rateLimits.channel.limit, window: config.rateLimits.channel.windowMs, scope: 'channel' });
    if (config.rateLimits.guild.enabled)    this.rateLimiters.guild   = new RateLimiter({ limit: config.rateLimits.guild.limit,   window: config.rateLimits.guild.windowMs,   scope: 'guild' });
  }

  public async processMessage(message: Message): Promise<void> {
    const responseHandler = new ResponseHandler(message, message.channel, message.author);

    if (!message.content.trim()) return;

    logger.debug(`Processing message from ${message.author.id}/${message.author.tag}: ${message.content.slice(0, 100)}...`);

    // Rate limit check
    const rateLimitResult = await this.checkRateLimits(message);
    if (!rateLimitResult.allowed && rateLimitResult.error) {
      await responseHandler.sendMessage(rateLimitResult.error);
      return;
    }

    // Generate plan
    const { context } = await this.buildMessageContext(message);
    const plan: Plan = await this.planner.generatePlan(context);

    // Handle response based on plan
    switch (plan.action) {
      case 'ignore': return;
      case 'message':
        // Start typing indicator
        await responseHandler.indicateTyping();

        // Generate AI response
        logger.debug(`Generating AI response with options: ${JSON.stringify(plan.openaiOptions)}`);
        const aiResponse = await this.openaiService.generateResponse(
          MAIN_MODEL,
          context,
          plan.openaiOptions
        );
        logger.debug(`Response recieved. Usage: ${JSON.stringify(aiResponse.usage)}`);

        // Get the assistant's response
        const responseText = aiResponse.message.content;

        // If the assistant has a response, send it
        if (responseText) {
          // Add assistant's response to context
          context.push({ role: 'assistant', content: responseText });
          
          // Send response
          await responseHandler.sendMessage(responseText, [], message.reference?.messageId 
            ? await message.channel.messages.fetch(message.reference.messageId) 
            : message);
          logger.debug(`Response sent.`);
        }
        return;
      case 'react':
        if (plan.reaction) {
          await responseHandler.addReaction(plan.reaction);
          logger.debug(`Reaction(s) sent.`);
        }
        return;
    }
  }

  private async buildMessageContext(message: Message): Promise<{ context: OpenAIMessage[] }> {
    const messages = await message.channel.messages.fetch({ limit: 10, before: message.id });
    const history: OpenAIMessage[] = Array.from(messages.values())
      .reverse()
      .filter(m => m.content.trim())
      .map(m => ({ role: 'user', content: m.content }));

    const context: OpenAIMessage[] = [{ role: 'system', content: this.systemPrompt }, ...history, { role: 'user', content: message.content }];
    return { context };
  }

  private async checkRateLimits(message: Message): Promise<{ allowed: boolean; error?: string }> {
    const results: Array<{ allowed: boolean; error?: string }> = [];

    if (this.rateLimiters.user) results.push(await this.rateLimiters.user.check(message.author.id, message.channel.id, message.guild?.id));
    if (this.rateLimiters.channel) results.push(await this.rateLimiters.channel.check(message.author.id, message.channel.id, message.guild?.id));
    if (this.rateLimiters.guild && message.guild) results.push(await this.rateLimiters.guild.check(message.author.id, message.channel.id, message.guild.id));

    return results.find(r => !r.allowed) ?? { allowed: true };
  }
}