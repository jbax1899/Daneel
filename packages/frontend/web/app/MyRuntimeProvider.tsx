"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

interface ToolCallFunction {
  name: string;
  arguments: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: ToolCallFunction;
}

const MyModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, context }) {
    const result = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        system: context?.system,
        tools: context?.tools,
      }),
      signal: abortSignal,
    });

    if (!result.ok) {
      const errorData = await result.text();
      console.error('API Error:', {
        status: result.status,
        statusText: result.statusText,
        error: errorData,
      });
      throw new Error(`API request failed with status ${result.status}`);
    }

    if (!result.body) {
      throw new Error('No response body received');
    }

    const reader = result.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolCalls: ToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Process the streamed chunks
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
          const delta = data.choices[0]?.delta;
          
          if (!delta) continue;

          // Handle text content
          if (delta.content) {
            content += delta.content;
          }

          // Handle tool calls
          if (delta.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              if (!toolCalls[toolCall.index]) {
                toolCalls[toolCall.index] = {
                  id: toolCall.id || `call_${Date.now()}_${toolCall.index}`,
                  type: 'function' as const,
                  function: { name: '', arguments: '' },
                };
              }
              
              if (toolCall.function?.name) {
                toolCalls[toolCall.index].function.name = toolCall.function.name;
              }
              
              if (toolCall.function?.arguments) {
                toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
              }
            }
          }

          // Yield the current state
          yield {
            content: content ? [{ type: 'text' as const, text: content }] : [],
            ...(toolCalls.length > 0 && { toolCalls }),
          };
        } catch (error) {
          console.error('Error parsing stream chunk:', error);
        }
      }
    }
  },
};

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const runtime = useLocalRuntime(MyModelAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
