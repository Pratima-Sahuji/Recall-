import { Conversation, Message, RecalledMemoryItem } from '../types';

const BASE_URL = '/api';

export async function checkHealth(): Promise<{ status: string; services: { api: string; database: string } }> {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE_URL}/conversations`);
  const data = await res.json();
  return data.data || [];
}

export async function createConversation(title?: string): Promise<Conversation> {
  const res = await fetch(`${BASE_URL}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  return data.data;
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const res = await fetch(`${BASE_URL}/conversations/${id}`);
  const data = await res.json();
  return data.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${BASE_URL}/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`);
  const data = await res.json();
  return data.data || [];
}

export async function sendMessage(
  conversationId: string,
  content: string,
  role: 'USER' | 'ASSISTANT' = 'USER',
): Promise<Message> {
  const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, role }),
  });
  const data = await res.json();
  return data.data;
}

export interface ToolCallEvent {
  tool: string;
  query: string;
  status: 'searching' | 'completed' | 'failed';
}

export interface StreamChatCallbacks {
  onChunk: (delta: string) => void;
  onToolEvent?: (event: ToolCallEvent) => void;
  onDone: (data: {
    userMessage: Message;
    assistantMessage: Message;
    recalledMemories?: RecalledMemoryItem[];
  }) => void;
  onError: (error: string) => void;
}

/**
 * Sends a message and consumes the Server-Sent Events stream in real-time.
 */
export async function streamChat(
  conversationId: string,
  message: string,
  callbacks: StreamChatCallbacks,
): Promise<void> {
  try {
    const response = await fetch(`${BASE_URL}/conversations/${conversationId}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      throw new Error(errorJson?.message || `HTTP error ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported by response');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processBlock = (block: string) => {
      if (!block.trim()) return;

      let eventType = 'message';
      let eventData = '';

      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          eventType = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          eventData = line.replace('data:', '').trim();
        }
      }

      if (eventData) {
        try {
          const parsed = JSON.parse(eventData);

          if (eventType === 'chunk') {
            callbacks.onChunk(parsed.delta || '');
          } else if (eventType === 'tool_call') {
            callbacks.onToolEvent?.(parsed);
          } else if (eventType === 'done') {
            callbacks.onDone(parsed);
          } else if (eventType === 'error') {
            callbacks.onError(parsed.message || 'Stream error occurred.');
          }
        } catch (e) {
          console.error('Failed to parse SSE payload:', eventData, e);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        processBlock(block);
      }
    }

    // Process any remaining data in buffer when stream ends
    if (buffer.trim()) {
      for (const block of buffer.split('\n\n')) {
        processBlock(block);
      }
    }
  } catch (err: any) {
    callbacks.onError(err.message || 'Failed to communicate with AI chat engine.');
  }
}
