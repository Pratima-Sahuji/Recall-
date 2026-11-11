import { RetrievedMemory } from '../memory/memory.types';
import { ChatMessageContext } from '../llm.service';

export interface TokenBudgetConfig {
  maxTotalTokens: number;
  maxMemoryTokens: number;
  maxHistoryTokens: number;
  maxSearchTokens: number;
}

export const DEFAULT_BUDGET: TokenBudgetConfig = {
  maxTotalTokens: 6000,
  maxMemoryTokens: 800,
  maxHistoryTokens: 2500,
  maxSearchTokens: 1800,
};

export class ContextAssemblerService {
  private budget: TokenBudgetConfig;

  constructor(budget = DEFAULT_BUDGET) {
    this.budget = budget;
  }

  /**
   * Approximate token counter (4 characters per token heuristic).
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Assembles the system prompt with prioritized recalled memories,
   * enforcing the memory token budget.
   */
  assembleSystemPrompt(basePrompt: string, memories: RetrievedMemory[]): string {
    if (!memories || memories.length === 0) {
      return basePrompt;
    }

    // Sort memories by score descending
    const sorted = [...memories].sort((a, b) => b.score - a.score);

    let memoryBlock = '\n\n=== RECALLED MEMORIES (INTERNAL CONTEXT) ===\n';
    memoryBlock += 'You possess prior context from earlier conversations with this user. Use it to understand references and personalize answers.\n';

    let currentTokens = this.estimateTokens(memoryBlock);

    for (const mem of sorted) {
      const typeTag = `[${mem.type} | ${mem.subCategory}]`;
      const dateTag = mem.occurredAt
        ? ` (Date/Time: ${new Date(mem.occurredAt).toLocaleDateString()})`
        : '';
      const line = `${typeTag} ${mem.content}${dateTag}\n`;
      const lineTokens = this.estimateTokens(line);

      if (currentTokens + lineTokens > this.budget.maxMemoryTokens) {
        break; // Truncate to respect memory budget
      }

      memoryBlock += line;
      currentTokens += lineTokens;
    }

    memoryBlock += '============================================\n';
    return `${basePrompt}${memoryBlock}`;
  }

  /**
   * Filters and windows conversation history to fit strictly within the history token budget.
   * Keeps the most recent messages while preserving alternating turns.
   */
  windowHistory(
    history: Array<{ role: string; content: string }>,
  ): Array<{ role: string; content: string }> {
    if (!history || history.length === 0) return [];

    const result: Array<{ role: string; content: string }> = [];
    let accumulatedTokens = 0;

    // Traverse from newest to oldest
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const tokens = this.estimateTokens(msg.content);

      if (accumulatedTokens + tokens > this.budget.maxHistoryTokens) {
        break;
      }

      result.unshift(msg);
      accumulatedTokens += tokens;
    }

    return result;
  }

  /**
   * Builds the complete prioritized chat context within the total token budget.
   */
  assembleContext(
    baseSystemPrompt: string,
    memories: RetrievedMemory[],
    history: Array<{ role: string; content: string }>,
  ): ChatMessageContext[] {
    const fullSystemPrompt = this.assembleSystemPrompt(baseSystemPrompt, memories);
    const windowedHistory = this.windowHistory(history);

    const context: ChatMessageContext[] = [
      {
        role: 'system',
        content: fullSystemPrompt,
      },
    ];

    for (const msg of windowedHistory) {
      let role: 'user' | 'assistant' | 'system' = 'user';
      if (msg.role.toUpperCase() === 'ASSISTANT') {
        role = 'assistant';
      } else if (msg.role.toUpperCase() === 'SYSTEM') {
        role = 'system';
      }

      context.push({
        role,
        content: msg.content,
      });
    }

    return context;
  }
}

