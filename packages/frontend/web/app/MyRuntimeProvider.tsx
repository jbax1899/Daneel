"use client";

import { useAuth } from "@clerk/nextjs";
import { AssistantCloud } from "assistant-cloud";
import { useEffect, useState, useMemo } from "react";
import { 
    AssistantRuntimeProvider, 
    useLocalRuntime, 
    type ChatModelAdapter,
    type ChatModelRunOptions,
    type ChatModelRunResult,
    type AttachmentAdapter
  } from "@assistant-ui/react";

// Custom AttachmentAdapter implementation
class CustomAttachmentAdapter implements AttachmentAdapter {
  accept = "image/*,application/pdf";
  multiple = true;

  async add(file: File): Promise<{
    id: string;
    type: string;
    name: string;
    url: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload file');
    }

    const { id, url } = await response.json();
    return {
      id,
      type: file.type.startsWith('image/') ? 'image' : 'document',
      name: file.name,
      url,
    };
  }

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/upload?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete file');
    }
  }
}

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
            // Include attachments in the request
            attachments: context?.attachments?.map(a => ({
              id: a.id,
              type: a.type,
              name: a.name,
              url: a.url,
            })),
          }),
          signal: abortSignal,
        });

        if (!result.ok) {
          const error = await result.json().catch(() => ({}));
          throw new Error(error.message || 'Failed to get response from server');
        }

        if (!result.body) {
          throw new Error('No response body');
        }

        const reader = result.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = '';

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  yield { content: parsed.choices[0]?.delta?.content || '' };
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in model adapter:', error);
        throw error;
      }
    },
  }), [userId]);

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
    adapters: { 
      attachments: new CustomAttachmentAdapter(),
    },
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