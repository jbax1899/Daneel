"use client";

import { useAuth } from "@clerk/nextjs";
import { AssistantCloud } from "assistant-cloud";
import { useEffect, useState, useMemo } from "react";
import { 
    AssistantRuntimeProvider, 
    useLocalRuntime, 
    type ChatModelAdapter,
    type ChatModelRunOptions,
    type ChatModelRunResult
  } from "@assistant-ui/react";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const [cloud, setCloud] = useState<AssistantCloud | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modelAdapter: ChatModelAdapter = useMemo(() => ({
    async *run({ messages, abortSignal, context }: ChatModelRunOptions) {
      console.log('Sending request with messages:', messages);
      
      try {
        const result = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            messages, 
            system: context?.system, 
            tools: context?.tools 
          }),
          signal: abortSignal,
        });
      
        if (!result.ok) {
          const errorData = await result.text();
          console.error('API Error:', { status: result.status, error: errorData });
          throw new Error(`API request failed with status ${result.status}: ${errorData}`);
        }

        const reader = result.body?.getReader();
        if (!reader) {
          throw new Error('Failed to read response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let content = "";
        const toolCalls: any[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (separated by double newlines for SSE)
            const lines = buffer.split(/\r?\n\r?\n/);
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              
              try {
                // Extract the JSON data (remove 'data: ' prefix)
                const jsonStr = line.startsWith('data: ') ? line.slice(6) : line;
                if (!jsonStr.trim()) continue;

                const data = JSON.parse(jsonStr);
                const delta = data.choices?.[0]?.delta;
                if (!delta) continue;

                // Handle text content
                if (delta.content !== undefined && delta.content !== null) {
                  content += String(delta.content);
                  
                  // Yield text content immediately
                  yield {
                    content: [{
                      type: 'text' as const,
                      text: content
                    }]
                  };
                }

                // Handle tool calls
                if (delta.tool_calls) {
                  for (const toolCall of delta.tool_calls) {
                    if (!toolCalls[toolCall.index]) {
                      toolCalls[toolCall.index] = {
                        id: toolCall.id || `call_${Date.now()}`,
                        type: "function",
                        function: { name: "", arguments: "" }
                      };
                    }

                    if (toolCall.function?.name) {
                      toolCalls[toolCall.index].function.name = toolCall.function.name;
                    }

                    if (toolCall.function?.arguments) {
                      toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                    }

                    // Yield tool call updates
                    if (toolCall.function?.name || toolCall.function?.arguments) {
                      try {
                        const args = toolCalls[toolCall.index].function.arguments 
                          ? JSON.parse(toolCalls[toolCall.index].function.arguments)
                          : {};
                        
                        yield {
                          content: [{
                            type: 'tool-call' as const,
                            toolCallId: toolCalls[toolCall.index].id,
                            toolName: toolCalls[toolCall.index].function.name,
                            args
                          }]
                        };
                      } catch (e) {
                        console.error('Error parsing tool call arguments:', e);
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing line:', line, 'Error:', e);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        console.error('Error in model adapter:', error);
        throw error;
      }
    }
  }), []);

  // Initialize the cloud instance
  useEffect(() => {
    if (!isLoaded || !userId) return;

    try {
      const cloudInstance = new AssistantCloud({
        apiKey: process.env.NEXT_PUBLIC_ASSISTANT_CLOUD_API_KEY || '',
        userId,
        workspaceId: process.env.NEXT_PUBLIC_ASSISTANT_CLOUD_WORKSPACE_ID || '',
      });
      setCloud(cloudInstance);
      setError(null);
    } catch (err) {
      console.error('Failed to initialize Assistant Cloud:', err);
      setError('Failed to initialize Assistant. Please try again.');
    }
  }, [isLoaded, userId]);

  // Initialize the runtime after cloud is ready
  const runtime = useLocalRuntime(modelAdapter, {
    cloud: cloud || undefined,
  });

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isLoaded || !runtime) {
    return <div className="p-4">Initializing Assistant...</div>;
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}