import { openai } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { streamText } from "ai";
import OpenAI from 'openai';

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = "edge";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, system, tools = {} } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required and cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        name: m.name,
      })),
      ...(system && { system }),
      ...(Object.keys(tools).length > 0 && { 
        tools: Object.entries(tools).map(([name, tool]: [string, any]) => ({
          type: 'function' as const,
          function: {
            name,
            description: tool.description,
            parameters: tool.parameters || {},
          },
        })),
      }),
      stream: true,
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
    return new Response(
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
