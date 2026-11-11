export type MemoryType = 'EPISODIC' | 'SEMANTIC';

export type MemorySubCategory =
  | 'CONVERSATION'
  | 'EVENT'
  | 'TASK'
  | 'PREFERENCE'
  | 'FACT'
  | 'OTHER';

export interface MemoryMetadata {
  type: MemoryType;
  subCategory: MemorySubCategory;
  statement: string;
  occurredAt?: string; // ISO date
  sourceMessageId?: string;
  keywords: string[];
}

export interface ExtractedMemory {
  type: MemoryType;
  subCategory: MemorySubCategory;
  content: string;
  importance: number; // 1.0 to 5.0
  occurredAt?: string;
  sourceMessageId?: string;
  keywords: string[];
}

export interface RetrievedMemory {
  id: string;
  type: MemoryType;
  subCategory: MemorySubCategory;
  content: string;
  importance: number;
  occurredAt?: string;
  createdAt: string;
  conversationId?: string;
  sourceMessageId?: string;
  score: number;
}

