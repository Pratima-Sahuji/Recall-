import { MemoryRepository } from '../../repositories/memory.repository';
import { MemoryExtractor } from './memoryExtractor';
import { MemoryRetriever } from './memoryRetriever';
import { ExtractedMemory, RetrievedMemory, MemoryMetadata } from './memory.types';
import { MemoryCategory } from '@prisma/client';

export class MemoryEngineService {
  constructor(
    private memoryRepo = new MemoryRepository(),
    private extractor = new MemoryExtractor(),
    private retriever = new MemoryRetriever(),
  ) {}

  /**
   * Retrieves memories relevant to the user query (both semantic and episodic).
   * Runs internally in the backend before LLM generation.
   */
  async retrieveMemories(
    userId: string,
    query: string,
    timezoneOffsetMinutes?: number,
    topK = 5,
  ): Promise<RetrievedMemory[]> {
    const rawMemories = await this.memoryRepo.findByUser(userId);
    return this.retriever.rankMemories(query, rawMemories, timezoneOffsetMinutes, topK);
  }

  /**
   * Formats retrieved memories into a clean context block for the system prompt.
   */
  formatMemoriesForContext(memories: RetrievedMemory[]): string {
    if (!memories || memories.length === 0) return '';

    let block = '\n--- RECALLED USER MEMORIES (INTERNAL CONTEXT) ---\n';
    block += 'Use these retrieved memories to accurately answer questions about previous discussions, events, preferences, or tasks.\n\n';

    for (const mem of memories) {
      const dateInfo = mem.occurredAt
        ? ` (Occurred/Mentioned: ${new Date(mem.occurredAt).toLocaleDateString()})`
        : ` (Stored: ${new Date(mem.createdAt).toLocaleDateString()})`;

      block += `- [${mem.type} | ${mem.subCategory}] ${mem.content}${dateInfo}\n`;
    }

    block += '--------------------------------------------------\n';
    return block;
  }

  /**
   * Extracts candidate memories from a conversation turn, handles deduplication,
   * resolves contradictions, and persists them into PostgreSQL.
   */
  async processAndStoreMemories(
    userId: string,
    conversationId: string,
    userContent: string,
    assistantReply?: string,
    messageId?: string,
    messageDate = new Date(),
  ): Promise<ExtractedMemory[]> {
    // 1. Extract candidates
    const candidates = await this.extractor.extractMemories(
      userContent,
      assistantReply,
      messageId,
      messageDate,
    );

    if (candidates.length === 0) return [];

    // 2. Fetch existing memories for deduplication and contradiction checking
    const existing = await this.memoryRepo.findByUser(userId);

    const storedMemories: ExtractedMemory[] = [];

    for (const candidate of candidates) {
      const isDuplicate = this.checkDuplicate(candidate, existing);
      if (isDuplicate) {
        continue;
      }

      // Check and handle contradictions
      await this.resolveContradictions(userId, candidate, existing);

      // Map subCategory to Prisma MemoryCategory
      const prismaCategory = this.mapCategory(candidate.subCategory);

      // Encode structured payload
      const payload: MemoryMetadata = {
        type: candidate.type,
        subCategory: candidate.subCategory,
        statement: candidate.content,
        occurredAt: candidate.occurredAt,
        sourceMessageId: candidate.sourceMessageId,
        keywords: candidate.keywords,
      };

      await this.memoryRepo.create({
        userId,
        conversationId,
        content: JSON.stringify(payload),
        category: prismaCategory,
        importance: candidate.importance,
      });

      storedMemories.push(candidate);
    }

    return storedMemories;
  }

  /**
   * Checks if candidate memory is a duplicate of an existing memory.
   */
  checkDuplicate(
    candidate: ExtractedMemory,
    existing: Array<{ content: string }>,
  ): boolean {
    const candidateLower = candidate.content.toLowerCase().trim();
    const candidateTokens = this.tokenize(candidateLower);

    for (const item of existing) {
      let existingStatement = item.content.toLowerCase().trim();
      try {
        if (item.content.startsWith('{')) {
          const parsed = JSON.parse(item.content);
          existingStatement = (parsed.statement || parsed.content || '').toLowerCase().trim();
        }
      } catch {
        // use raw
      }

      if (candidateLower === existingStatement) {
        return true;
      }

      const existingTokens = this.tokenize(existingStatement);
      const similarity = this.computeJaccard(candidateTokens, existingTokens);
      if (similarity > 0.8) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identifies contradictory memories (e.g. preference changes) and replaces the old one.
   */
  async resolveContradictions(
    userId: string,
    candidate: ExtractedMemory,
    existing: Array<{ id: string; content: string }>,
  ): Promise<void> {
    if (candidate.subCategory !== 'PREFERENCE' && candidate.subCategory !== 'FACT') {
      return;
    }

    const candidateLower = candidate.content.toLowerCase();

    for (const item of existing) {
      let existingStatement = '';
      try {
        if (item.content.startsWith('{')) {
          const parsed = JSON.parse(item.content);
          if (parsed.subCategory === candidate.subCategory) {
            existingStatement = (parsed.statement || '').toLowerCase();
          }
        }
      } catch {
        // ignore
      }

      if (!existingStatement) continue;

      // Check for opposite preference shifts (e.g., "dark mode" vs "light mode", "vegetarian" vs "meat")
      const isContradiction =
        (candidateLower.includes('dark mode') && existingStatement.includes('light mode')) ||
        (candidateLower.includes('light mode') && existingStatement.includes('dark mode')) ||
        (candidateLower.includes('prefer python') && existingStatement.includes('prefer typescript')) ||
        (candidateLower.includes('prefer typescript') && existingStatement.includes('prefer python'));

      if (isContradiction) {
        // Delete outdated contradictory memory
        try {
          await this.memoryRepo.delete(item.id);
        } catch {
          // ignore if already deleted
        }
      }
    }
  }

  private mapCategory(subCategory: string): MemoryCategory {
    switch (subCategory) {
      case 'PREFERENCE':
        return MemoryCategory.PREFERENCE;
      case 'TASK':
        return MemoryCategory.GOAL;
      case 'CONVERSATION':
        return MemoryCategory.CONTEXT;
      case 'EVENT':
        return MemoryCategory.CONTEXT;
      case 'FACT':
      default:
        return MemoryCategory.FACT;
    }
  }

  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  }

  private computeJaccard(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const elem of setA) {
      if (setB.has(elem)) intersection++;
    }
    return intersection / (setA.size + setB.size - intersection);
  }
}

