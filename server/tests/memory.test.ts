import { MemoryExtractor } from '../src/services/memory/memoryExtractor';
import { MemoryRetriever } from '../src/services/memory/memoryRetriever';
import { MemoryEngineService } from '../src/services/memory/memory.service';
import { parseTemporalReference } from '../src/utils/temporalParser';

describe('Phase 4: Recall Memory Engine', () => {
  describe('Temporal Parser (Dates & Timezone)', () => {
    const fixedNow = new Date('2026-11-11T12:00:00.000Z');

    it('should parse "yesterday" accurately', () => {
      const range = parseTemporalReference('What did I ask you yesterday?', fixedNow);
      expect(range).not.toBeNull();
      expect(range?.label).toBe('yesterday');
      // Yesterday should start at Nov 10 00:00:00
      expect(range?.start.toISOString()).toContain('2026-11-10');
      expect(range?.end.toISOString()).toContain('2026-11-10T23:59:59');
    });

    it('should parse "today" accurately', () => {
      const range = parseTemporalReference('What was my plan today?', fixedNow);
      expect(range).not.toBeNull();
      expect(range?.label).toBe('today');
      expect(range?.start.toISOString()).toContain('2026-11-11T00:00:00');
    });

    it('should parse "last week" accurately', () => {
      const range = parseTemporalReference('What task did I mention last week?', fixedNow);
      expect(range).not.toBeNull();
      expect(range?.label).toBe('last week');
      expect(range?.start.getTime()).toBeLessThan(fixedNow.getTime());
    });

    it('should parse "earlier" accurately', () => {
      const range = parseTemporalReference('What was the technology I discussed earlier?', fixedNow);
      expect(range).not.toBeNull();
      expect(range?.label).toBe('earlier');
      expect(range?.end.getTime()).toBe(fixedNow.getTime());
    });

    it('should adjust date ranges according to timezone offset', () => {
      // Offset for UTC+5:30 is -330
      const range = parseTemporalReference('yesterday', fixedNow, -330);
      expect(range).not.toBeNull();
      expect(range?.label).toBe('yesterday');
    });
  });

  describe('Memory Extraction', () => {
    let extractor: MemoryExtractor;

    beforeEach(() => {
      extractor = new MemoryExtractor();
    });

    it('should avoid storing insignificant or trivial messages', () => {
      expect(extractor.isTrivialMessage('hi')).toBe(true);
      expect(extractor.isTrivialMessage('hello')).toBe(true);
      expect(extractor.isTrivialMessage('ok')).toBe(true);
      expect(extractor.isTrivialMessage('thanks')).toBe(true);
      expect(extractor.isTrivialMessage('how are you')).toBe(true);
    });

    it('should extract episodic tasks and commitments', async () => {
      const extracted = extractor.ruleBasedExtraction(
        'I need to deploy the production server by Friday',
        'msg-task-1',
        new Date('2026-11-11T10:00:00.000Z'),
      );

      expect(extracted).toHaveLength(1);
      expect(extracted[0].type).toBe('EPISODIC');
      expect(extracted[0].subCategory).toBe('TASK');
      expect(extracted[0].sourceMessageId).toBe('msg-task-1');
      expect(extracted[0].content).toContain('deploy the production server');
    });

    it('should extract semantic preferences', async () => {
      const extracted = extractor.ruleBasedExtraction(
        'I prefer TypeScript over Python for backend projects',
        'msg-pref-1',
      );

      expect(extracted).toHaveLength(1);
      expect(extracted[0].type).toBe('SEMANTIC');
      expect(extracted[0].subCategory).toBe('PREFERENCE');
      expect(extracted[0].content).toContain('TypeScript');
    });

    it('should extract enduring facts', async () => {
      const extracted = extractor.ruleBasedExtraction(
        'I work at Acme Robotics as a principal software engineer',
        'msg-fact-1',
      );

      expect(extracted).toHaveLength(1);
      expect(extracted[0].type).toBe('SEMANTIC');
      expect(extracted[0].subCategory).toBe('FACT');
      expect(extracted[0].content).toContain('Acme Robotics');
    });
  });

  describe('Memory Retrieval & Relevance', () => {
    let retriever: MemoryRetriever;

    beforeEach(() => {
      retriever = new MemoryRetriever();
    });

    const mockRawMemories = [
      {
        id: 'mem-1',
        content: JSON.stringify({
          type: 'SEMANTIC',
          subCategory: 'PREFERENCE',
          statement: 'User prefers PostgreSQL and Prisma for relational data',
          keywords: ['postgresql', 'prisma', 'database'],
        }),
        importance: 4.0,
        createdAt: new Date('2026-11-01T10:00:00.000Z'),
        conversationId: 'conv-1',
      },
      {
        id: 'mem-2',
        content: JSON.stringify({
          type: 'EPISODIC',
          subCategory: 'TASK',
          statement: 'User needs to submit quarterly report before Friday',
          keywords: ['report', 'quarterly', 'friday'],
        }),
        importance: 4.5,
        createdAt: new Date('2026-11-10T14:00:00.000Z'), // Yesterday
        conversationId: 'conv-2',
      },
      {
        id: 'mem-3',
        content: JSON.stringify({
          type: 'EPISODIC',
          subCategory: 'CONVERSATION',
          statement: 'Discussed Redis caching strategies for high-throughput APIs',
          keywords: ['redis', 'caching', 'technology'],
        }),
        importance: 3.0,
        createdAt: new Date('2026-11-11T09:00:00.000Z'), // Earlier today
        conversationId: 'conv-3',
      },
    ];

    it('should retrieve memories by semantic relevance ("technology I discussed")', () => {
      const results = retriever.rankMemories('What was the technology I discussed earlier?', mockRawMemories);

      expect(results.length).toBeGreaterThan(0);
      // Redis caching discussion should rank high
      const redisMem = results.find((r) => r.content.includes('Redis'));
      expect(redisMem).toBeDefined();
    });

    it('should prioritize memories matching temporal queries ("What did I ask you yesterday?")', () => {
      // Mock query asked on Nov 11 about yesterday (Nov 10)
      const results = retriever.rankMemories(
        'What task did I mention yesterday?',
        mockRawMemories,
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('quarterly report');
      expect(results[0].subCategory).toBe('TASK');
    });
  });

  describe('Duplicate & Contradiction Management', () => {
    let memoryEngine: MemoryEngineService;
    let mockRepo: any;

    beforeEach(() => {
      mockRepo = {
        findByUser: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      };
      memoryEngine = new MemoryEngineService(mockRepo);
    });

    it('should detect and prevent duplicate memories', () => {
      const existing = [
        {
          content: JSON.stringify({
            statement: 'I prefer TypeScript over Python',
          }),
        },
      ];

      const candidate = {
        type: 'SEMANTIC' as const,
        subCategory: 'PREFERENCE' as const,
        content: 'I prefer TypeScript over Python',
        importance: 4.0,
        keywords: ['typescript', 'python'],
      };

      const isDupe = memoryEngine.checkDuplicate(candidate, existing);
      expect(isDupe).toBe(true);
    });

    it('should delete outdated contradictory preference memories', async () => {
      const existing = [
        {
          id: 'old-mem-1',
          content: JSON.stringify({
            subCategory: 'PREFERENCE',
            statement: 'I prefer light mode in all apps',
          }),
        },
      ];

      const newCandidate = {
        type: 'SEMANTIC' as const,
        subCategory: 'PREFERENCE' as const,
        content: 'I changed my mind, I now prefer dark mode',
        importance: 4.0,
        keywords: ['dark', 'mode'],
      };

      await memoryEngine.resolveContradictions('user-1', newCandidate, existing);

      expect(mockRepo.delete).toHaveBeenCalledWith('old-mem-1');
    });
  });
});

