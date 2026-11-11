import OpenAI from 'openai';
import { ExtractedMemory } from './memory.types';
import { config } from '../../config';

export class MemoryExtractor {
  private openai: OpenAI | null = null;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || config.openai.apiKey;
    this.model = model || config.openai.model;
    if (key) {
      this.openai = new OpenAI({
        apiKey: key,
        baseURL: config.llm.baseURL,
      });
    }
  }

  /**
   * Fast rule-based filter to reject trivial chit-chat or meaningless utterances
   * before spending tokens on extraction.
   */
  isTrivialMessage(content: string): boolean {
    const trimmed = content.trim().toLowerCase();
    if (trimmed.length < 5) return true;

    const trivialPatterns = [
      /^(hi|hello|hey|yo|greetings|good\s+(morning|afternoon|evening))\b/i,
      /^(ok|okay|yes|no|yep|nope|sure|cool|alright|fine|thanks|thank\s+you|thx)\b/i,
      /^(how\s+are\s+you|what's\s+up|what\s+is\s+up)\b/i,
      /^(bye|goodbye|see\s+ya|cya)\b/i,
    ];

    return trivialPatterns.some((p) => p.test(trimmed));
  }

  /**
   * Extracts candidate episodic and semantic memories from a conversation exchange.
   */
  async extractMemories(
    userContent: string,
    assistantReply?: string,
    messageId?: string,
    messageDate = new Date(),
  ): Promise<ExtractedMemory[]> {
    if (this.isTrivialMessage(userContent)) {
      return [];
    }

    if (!this.openai) {
      // Fallback rule-based extraction if OpenAI is unavailable
      return this.ruleBasedExtraction(userContent, messageId, messageDate);
    }

    const prompt = `Analyze this conversation exchange and extract meaningful user memories.

User Message: "${userContent}"
${assistantReply ? `Assistant Reply: "${assistantReply}"` : ''}
Timestamp: "${messageDate.toISOString()}"

Categories:
1. EPISODIC:
   - EVENTS: Life events, meetings, milestones, scheduled dates
   - TASKS: Commitments, todos, deadlines ("I need to...", "I will...")
   - CONVERSATIONS: Significant technical topics discussed, questions explored, or decisions made

2. SEMANTIC:
   - PREFERENCES: User likes, dislikes, preferences ("I prefer...", "I always use...")
   - FACTS: Enduring personal facts (role, location, company, background, habits)

Rules:
- Do NOT extract trivial chit-chat, greetings, or ephemeral questions.
- If the text has no long-term or episodic value, return an empty array [].
- Preserve original timestamps when dates are mentioned.

Return ONLY a JSON array of objects conforming to this schema:
[
  {
    "type": "EPISODIC" | "SEMANTIC",
    "subCategory": "EVENT" | "TASK" | "CONVERSATION" | "PREFERENCE" | "FACT",
    "content": "Concise factual statement summarizing the memory",
    "importance": number between 1.0 and 5.0,
    "occurredAt": "ISO date string or omit if not applicable",
    "keywords": ["key1", "key2"]
  }
]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const raw = response.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed.memories || parsed.items || [];

      return items.map((item: any) => ({
        type: item.type === 'EPISODIC' ? 'EPISODIC' : 'SEMANTIC',
        subCategory: item.subCategory || 'FACT',
        content: item.content || userContent,
        importance: Math.min(Math.max(Number(item.importance) || 2.0, 1.0), 5.0),
        occurredAt: item.occurredAt || messageDate.toISOString(),
        sourceMessageId: messageId,
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
      }));
    } catch (err) {
      console.warn('[MemoryExtractor] LLM extraction error, falling back to rule-based:', err);
      return this.ruleBasedExtraction(userContent, messageId, messageDate);
    }
  }

  /**
   * Deterministic rule-based extractor (used in unit tests or when LLM is offline)
   */
  ruleBasedExtraction(
    content: string,
    messageId?: string,
    messageDate = new Date(),
  ): ExtractedMemory[] {
    const memories: ExtractedMemory[] = [];
    const lower = content.toLowerCase();

    // 1. Preferences
    if (/\b(i\s+prefer|i\s+like|i\s+love|i\s+hate|my\s+favorite)\b/i.test(lower)) {
      memories.push({
        type: 'SEMANTIC',
        subCategory: 'PREFERENCE',
        content: content.trim(),
        importance: 4.0,
        sourceMessageId: messageId,
        occurredAt: messageDate.toISOString(),
        keywords: this.extractKeywords(content),
      });
    }

    // 2. Facts
    else if (/\b(i\s+am|i\s+work\s+at|i\s+live\s+in|my\s+name\s+is|my\s+job\s+is)\b/i.test(lower)) {
      memories.push({
        type: 'SEMANTIC',
        subCategory: 'FACT',
        content: content.trim(),
        importance: 4.5,
        sourceMessageId: messageId,
        occurredAt: messageDate.toISOString(),
        keywords: this.extractKeywords(content),
      });
    }

    // 3. Tasks / Commitments
    else if (/\b(i\s+need\s+to|i\s+must|i\s+have\s+to|i\s+will|remind\s+me\s+to|todo)\b/i.test(lower)) {
      memories.push({
        type: 'EPISODIC',
        subCategory: 'TASK',
        content: content.trim(),
        importance: 3.5,
        sourceMessageId: messageId,
        occurredAt: messageDate.toISOString(),
        keywords: this.extractKeywords(content),
      });
    }

    // 4. Events / Dates
    else if (/\b(yesterday|tomorrow|next\s+week|meeting|interview|conference|deadline|flight)\b/i.test(lower)) {
      memories.push({
        type: 'EPISODIC',
        subCategory: 'EVENT',
        content: content.trim(),
        importance: 3.5,
        sourceMessageId: messageId,
        occurredAt: messageDate.toISOString(),
        keywords: this.extractKeywords(content),
      });
    }

    // 5. Significant questions or discussions (length > 40 chars)
    else if (content.length > 40) {
      memories.push({
        type: 'EPISODIC',
        subCategory: 'CONVERSATION',
        content: `Discussed: ${content.trim()}`,
        importance: 2.5,
        sourceMessageId: messageId,
        occurredAt: messageDate.toISOString(),
        keywords: this.extractKeywords(content),
      });
    }

    return memories;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'have'].includes(w));
  }
}

