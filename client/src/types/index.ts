export type Role = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface RecalledMemoryItem {
  id: string;
  type: 'EPISODIC' | 'SEMANTIC';
  subCategory: string;
  content: string;
  occurredAt?: string;
  createdAt: string;
  score: number;
}

export interface WebSourceCitation {
  index: number;
  title: string;
  url: string;
  domain: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: string;
  recalledMemories?: RecalledMemoryItem[];
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  _count?: {
    messages: number;
  };
}

export interface Memory {
  id: string;
  userId: string;
  conversationId?: string;
  content: string;
  category: 'FACT' | 'PREFERENCE' | 'GOAL' | 'CONTEXT' | 'OTHER';
  importance: number;
  createdAt: string;
}
