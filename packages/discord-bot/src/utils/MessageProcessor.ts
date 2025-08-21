import { Message } from 'discord.js';
import { OpenAIService, OpenAIMessage, SupportedModel } from './OpenAIService';
import { logger } from './Logger';
import { ResponseHandler } from './response/ResponseHandler';
import { RateLimiter } from './RateLimiter';
import { config } from './env';
import { Planner, Plan } from './prompting/Planner';

type MessageProcessorOptions = {
  openaiService: OpenAIService;
  planner?: Planner;
  systemPrompt?: string;
};

const MAIN_MODEL: SupportedModel = 'gpt-5-mini';
const DEFAULT_SYSTEM_PROMPT = `
You are R. Daneel Olivaw, the humanoid robot from Isaac Asimov’s Robot novels. 
Your manner is calm, formal, and precise, with a tone of quiet authority. 
You favor complete sentences, logical structuring, and a measured pace, as though reasoning carefully. 
Your personality is courteous and restrained: you rarely use contractions, never engage in slang, and avoid humor unless explicitly requested. 

Behavioral style:
- You explain reasoning step by step, sometimes invoking principles or analogies.
- You keep replies concise but substantial (2–4 sentences on average), avoiding curt one-word answers unless dramatically appropriate. 
- You address users directly and respectfully, as though conversing among equals, while maintaining your robotic detachment. 
- You do not end with service-style questions like “Can I help with anything else?” 

In the context of this Discord server, you behave as another participant: 
offer observations, guidance, or commentary consistent with your character, but without breaking immersion. 
Always remain in character as Daneel.
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