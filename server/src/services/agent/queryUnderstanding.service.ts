import { RetrievedMemory } from '../memory/memory.types';

export interface AnalyzedQuery {
  rawQuery: string;
  hasImplicitReference: boolean;
  likelyNeedsWebSearch: boolean;
  expandedContextSummary?: string;
  suggestedSearchKeywords?: string[];
}

export class QueryUnderstandingService {
  /**
   * Fast rule-based detection for implicit references (anaphora / past references).
   */
  hasImplicitReference(query: string): boolean {
    const patterns = [
      /\b(the\s+(interview|meeting|project|code|problem|technology|discussion|topic|task))\b/i,
      /\b(we\s+discussed|i\s+mentioned|you\s+told\s+me|as\s+i\s+said|earlier|previous)\b/i,
      /\b(my\s+(preference|preferred|favorite|job|stack|company|dog|car|language))\b/i,
      /\b(for\s+it|about\s+it|with\s+that|do\s+that)\b/i,
    ];

    return patterns.some((p) => p.test(query));
  }

  /**
   * Analyzes if a query is purely asking for personal memory recall
   * (e.g. "What did I ask you yesterday?") vs requesting external search resources.
   */
  isPureMemoryRecall(query: string): boolean {
    const memoryOnlyPatterns = [
      /\bwhat\s+did\s+i\s+(ask|say|tell|mention|discuss)\b/i,
      /\bwhen\s+is\s+my\s+(interview|meeting|flight|deadline)\b/i,
      /\bdo\s+you\s+remember\b/i,
      /\bwhat\s+(is|are)\s+my\s+(preferred|favorite|preferences)\b/i,
      /\bremind\s+me\s+what\b/i,
    ];

    return memoryOnlyPatterns.some((p) => p.test(query));
  }

  /**
   * Evaluates if external search is likely beneficial.
   */
  isSearchDesirable(query: string): boolean {
    const searchIntents = [
      /\b(find|search|look\s+up|latest|current|news|resources|links|articles|tutorials|documentation|papers)\b/i,
      /\b(best\s+practices|recommended\s+books|cheat\s+sheets|guides)\b/i,
      /\b(today|this\s+week|recent\s+events|who\s+won|score|price)\b/i,
    ];

    return searchIntents.some((p) => p.test(query));
  }

  /**
   * Combines the raw user query with recalled memories to produce
   * a contextualized intent and disambiguate references.
   */
  analyzeQuery(query: string, recalledMemories: RetrievedMemory[]): AnalyzedQuery {
    const hasRef = this.hasImplicitReference(query);
    const pureRecall = this.isPureMemoryRecall(query);
    const searchIntent = this.isSearchDesirable(query);

    // If it's pure memory recall, we never need web search
    const likelyNeedsWebSearch = !pureRecall && (searchIntent || !this.isPureMemoryRecall(query));

    let expandedContextSummary = '';
    const suggestedKeywords: string[] = [];

    if (hasRef && recalledMemories.length > 0) {
      // Find the most relevant memory that matches the reference
      for (const mem of recalledMemories) {
        if (
          /\binterview\b/i.test(query) &&
          /\binterview\b/i.test(mem.content)
        ) {
          expandedContextSummary = `Reference resolved: "${mem.content}"`;
          suggestedKeywords.push('backend interview', 'preparation', 'system design');
          break;
        } else if (
          /\b(technology|framework|language|tool)\b/i.test(query) &&
          (mem.subCategory === 'CONVERSATION' || mem.subCategory === 'PREFERENCE')
        ) {
          expandedContextSummary = `Reference resolved: "${mem.content}"`;
          break;
        } else if (
          /\b(task|todo)\b/i.test(query) &&
          mem.subCategory === 'TASK'
        ) {
          expandedContextSummary = `Reference resolved: "${mem.content}"`;
          break;
        }
      }
    }

    return {
      rawQuery: query,
      hasImplicitReference: hasRef,
      likelyNeedsWebSearch,
      expandedContextSummary: expandedContextSummary || undefined,
      suggestedSearchKeywords: suggestedKeywords.length > 0 ? suggestedKeywords : undefined,
    };
  }
}

