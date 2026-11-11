import { RetrievedMemory, MemoryMetadata } from './memory.types';
import { parseTemporalReference } from '../../utils/temporalParser';

export class MemoryRetriever {
  /**
   * Retrieves and ranks candidate memories based on joint semantic
   * and temporal relevance to the user's query.
   */
  rankMemories(
    query: string,
    rawMemories: Array<{
      id: string;
      content: string;
      importance: number;
      createdAt: Date;
      conversationId: string | null;
    }>,
    timezoneOffsetMinutes?: number,
    topK = 5,
  ): RetrievedMemory[] {
    if (!rawMemories || rawMemories.length === 0) return [];

    const queryLower = query.toLowerCase();
    const queryTokens = this.tokenize(queryLower);

    // Detect if the query has a temporal dimension ("yesterday", "last week", "earlier", etc.)
    const temporalRange = parseTemporalReference(query, new Date(), timezoneOffsetMinutes);

    const scored: RetrievedMemory[] = [];

    for (const mem of rawMemories) {
      const parsed = this.parseStoredMemory(mem.content);
      const statement = parsed.statement || mem.content;
      const memTokens = this.tokenize(statement.toLowerCase());

      // 1. Semantic Relevance Score (Jaccard + keyword overlap)
      const semanticScore = this.computeSemanticScore(queryTokens, memTokens);

      // 2. Temporal Relevance Score
      let temporalScore = 0;
      const memTimestamp = parsed.occurredAt
        ? new Date(parsed.occurredAt).getTime()
        : mem.createdAt.getTime();

      if (temporalRange) {
        const start = temporalRange.start.getTime();
        const end = temporalRange.end.getTime();

        if (memTimestamp >= start && memTimestamp <= end) {
          // Strong temporal match
          temporalScore = 1.0;
        } else {
          // Falloff based on temporal distance
          const distance = Math.min(
            Math.abs(memTimestamp - start),
            Math.abs(memTimestamp - end),
          );
          const oneDay = 24 * 60 * 60 * 1000;
          temporalScore = Math.max(0, 0.5 - distance / (7 * oneDay));
        }
      }

      // 3. Category match boost
      let categoryBoost = 0;
      if (/\b(task|todo|commitment|finish|remind)\b/i.test(queryLower) && parsed.subCategory === 'TASK') {
        categoryBoost = 0.4;
      } else if (/\b(prefer|like|favorite)\b/i.test(queryLower) && parsed.subCategory === 'PREFERENCE') {
        categoryBoost = 0.4;
      } else if (/\b(tech|technology|framework|language|tool)\b/i.test(queryLower) && parsed.subCategory === 'CONVERSATION') {
        categoryBoost = 0.3;
      }

      // 4. Combined weighted score
      // If a temporal range was explicitly requested, heavily prioritize temporal matching
      let finalScore = 0;
      if (temporalRange) {
        finalScore = temporalScore * 0.6 + semanticScore * 0.3 + (mem.importance / 5) * 0.1 + categoryBoost;
      } else {
        finalScore = semanticScore * 0.7 + (mem.importance / 5) * 0.2 + categoryBoost;
      }

      // Only include memories with meaningful relevance
      if (finalScore > 0.15 || (temporalRange && temporalScore > 0.8)) {
        scored.push({
          id: mem.id,
          type: parsed.type,
          subCategory: parsed.subCategory,
          content: statement,
          importance: mem.importance,
          occurredAt: parsed.occurredAt,
          createdAt: mem.createdAt.toISOString(),
          conversationId: mem.conversationId || undefined,
          sourceMessageId: parsed.sourceMessageId,
          score: finalScore,
        });
      }
    }

    // Sort descending by score and pick top K
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Parses memory content. If stored as structured JSON, decodes it;
   * otherwise treats content as raw statement.
   */
  parseStoredMemory(raw: string): MemoryMetadata {
    try {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const json = JSON.parse(raw);
        return {
          type: json.type || 'SEMANTIC',
          subCategory: json.subCategory || 'FACT',
          statement: json.statement || json.content || raw,
          occurredAt: json.occurredAt,
          sourceMessageId: json.sourceMessageId,
          keywords: Array.isArray(json.keywords) ? json.keywords : [],
        };
      }
    } catch {
      // not JSON
    }

    return {
      type: 'SEMANTIC',
      subCategory: 'FACT',
      statement: raw,
      keywords: [],
    };
  }

  private computeSemanticScore(queryTokens: Set<string>, memTokens: Set<string>): number {
    if (queryTokens.size === 0 || memTokens.size === 0) return 0;

    let overlap = 0;
    for (const token of queryTokens) {
      if (memTokens.has(token)) {
        overlap++;
      }
    }

    // Return dice coefficient
    return (2 * overlap) / (queryTokens.size + memTokens.size);
  }

  private tokenize(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'was', 'for', 'you', 'did'].includes(w));
    return new Set(words);
  }
}

