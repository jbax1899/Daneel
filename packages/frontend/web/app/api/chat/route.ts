import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = "edge";
export const maxDuration = 30;

interface ToolParameter {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

interface ToolDefinition {
  description: string;
  parameters: ToolParameter;
}

type ToolsRecord = Record<string, ToolDefinition>;

export async function POST(req: Request) {
  try {
    const { messages, system, tools = {} } = await req.json() as {
      messages: Array<{ role: string; content: string; name?: string }>;
      system?: string;
      tools?: ToolsRecord;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Messages array is required and cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map(m => {
        // For function messages
        if (m.role === 'function' && m.name) {
          return {
            role: 'function' as const,
            name: m.name,
            content: m.content,
          } as const;
        }

        // For assistant messages
        if (m.role === 'assistant') {
          return m.name ? {
            role: 'assistant' as const,
            name: m.name,
            content: m.content,
          } : {
            role: 'assistant' as const,
            content: m.content,
          };
        }

        // For user messages
        if (m.role === 'user') {
          return m.name ? {
            role: 'user' as const,
            name: m.name,
            content: m.content,
          } : {
            role: 'user' as const,
            content: m.content,
          };
        }

        // For system messages (no name allowed)
        if (m.role === 'system') {
          return {
            role: 'system' as const,
            content: m.content,
          };
        }

        // Fallback (shouldn't happen with proper typing)
        return {
          role: m.role as 'user' | 'assistant' | 'system' | 'function',
          content: m.content,
        };
      }) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...(system && { system }),
      ...(tools && Object.keys(tools).length > 0 && { 
        tools: Object.entries(tools).map(([name, tool]) => ({
          type: 'function' as const,
          function: {
            name,
            description: tool.description,
            parameters: tool.parameters as unknown as Record<string, unknown>,
          },
        })) as OpenAI.Chat.Completions.ChatCompletionTool[],
      }),
      stream: true as const,
    });

    // Create a new ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const stream = response as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
          
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch (error) {
          console.error('Error streaming response:', error);
        } finally {
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat API route:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
