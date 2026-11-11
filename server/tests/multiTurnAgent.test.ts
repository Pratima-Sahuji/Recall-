import { ContextAwareAgentService } from '../src/services/agent/contextAwareAgent.service';
import { QueryUnderstandingService } from '../src/services/agent/queryUnderstanding.service';
import { ContextAssemblerService } from '../src/services/agent/contextAssembler.service';
import { Role } from '@prisma/client';

describe('Phase 5: Context-Aware Agent Integration Tests', () => {
  describe('Query Understanding & Disambiguation', () => {
    let queryUnderstanding: QueryUnderstandingService;

    beforeEach(() => {
      queryUnderstanding = new QueryUnderstandingService();
    });

    it('should identify implicit references ("the interview we discussed")', () => {
      expect(
        queryUnderstanding.hasImplicitReference('Find some resources for the interview we discussed'),
      ).toBe(true);
      expect(
        queryUnderstanding.hasImplicitReference('What about that project?'),
      ).toBe(true);
      expect(
        queryUnderstanding.hasImplicitReference('What is 2 + 2?'),
      ).toBe(false);
    });

    it('should distinguish pure memory recall from search intents', () => {
      expect(
        queryUnderstanding.isPureMemoryRecall('What did I ask you yesterday?'),
      ).toBe(true);
      expect(
        queryUnderstanding.isPureMemoryRecall('When is my interview?'),
      ).toBe(true);
      expect(
        queryUnderstanding.isSearchDesirable('Find some resources for the interview we discussed'),
      ).toBe(true);
    });

    it('should resolve implicit references using recalled memories', () => {
      const recalledMemories = [
        {
          id: 'mem-1',
          type: 'EPISODIC' as const,
          subCategory: 'EVENT' as const,
          content: 'User is preparing for a backend interview next Friday',
          importance: 4.5,
          createdAt: new Date().toISOString(),
          score: 0.95,
        },
      ];

      const analysis = queryUnderstanding.analyzeQuery(
        'Find some resources for the interview we discussed',
        recalledMemories,
      );

      expect(analysis.hasImplicitReference).toBe(true);
      expect(analysis.likelyNeedsWebSearch).toBe(true);
      expect(analysis.expandedContextSummary).toContain('backend interview');
      expect(analysis.suggestedSearchKeywords).toContain('backend interview');
    });
  });

  describe('Context Assembler & Token Budgeting', () => {
    let contextAssembler: ContextAssemblerService;

    beforeEach(() => {
      contextAssembler = new ContextAssemblerService({
        maxTotalTokens: 1000,
        maxMemoryTokens: 150,
        maxHistoryTokens: 400,
        maxSearchTokens: 300,
      });
    });

    it('should assemble system prompt with prioritized memories and truncate if exceeding budget', () => {
      const memories = Array.from({ length: 20 }, (_, i) => ({
        id: `mem-${i}`,
        type: 'SEMANTIC' as const,
        subCategory: 'FACT' as const,
        content: `Very detailed memory statement number ${i} with long descriptive text about user habits`,
        importance: 4.0,
        createdAt: new Date().toISOString(),
        score: 1.0 - i * 0.05,
      }));

      const assembled = contextAssembler.assembleSystemPrompt('Base prompt', memories);

      expect(assembled).toContain('Base prompt');
      expect(assembled).toContain('=== RECALLED MEMORIES');
      // Should not include all 20 memories due to token budget constraint
      expect(assembled).not.toContain('memory statement number 19');
    });

    it('should window history to respect history budget', () => {
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message turn ${i} containing text that consumes tokens`,
      }));

      const windowed = contextAssembler.windowHistory(history);

      expect(windowed.length).toBeLessThan(30);
      // Ensures the most recent messages are kept
      expect(windowed[windowed.length - 1].content).toContain('Message turn 29');
    });
  });

  describe('Multi-Turn Context-Aware Conversation Integration', () => {
    let agentService: ContextAwareAgentService;
    let mockMessageRepo: any;
    let mockConversationRepo: any;
    let mockLLMService: any;
    let mockMemoryEngine: any;

    beforeEach(() => {
      mockMessageRepo = {
        create: jest.fn(),
        findByConversation: jest.fn(),
      };

      mockConversationRepo = {
        findById: jest.fn(),
        updateTitle: jest.fn(),
      };

      mockLLMService = {
        generateWithTools: jest.fn(),
        streamWithTools: jest.fn(),
      };

      mockMemoryEngine = {
        retrieveMemories: jest.fn(),
        formatMemoriesForContext: jest.fn(),
        processAndStoreMemories: jest.fn(),
      };

      agentService = new ContextAwareAgentService(
        mockMessageRepo,
        mockConversationRepo,
        mockLLMService,
        mockMemoryEngine,
      );
    });

    it('Turn 1: stores interview preparation in memory without needing web search', async () => {
      const conversationId = 'conv-turn-1';
      mockConversationRepo.findById.mockResolvedValueOnce({
        id: conversationId,
        title: 'New Conversation',
        userId: 'user-1',
      });

      const userMsg = {
        id: 'msg-1',
        conversationId,
        role: Role.USER,
        content: 'I am preparing for a backend interview next Friday.',
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(userMsg);
      mockMessageRepo.findByConversation.mockResolvedValueOnce([userMsg]);
      mockMemoryEngine.retrieveMemories.mockResolvedValueOnce([]);

      mockLLMService.generateWithTools.mockResolvedValueOnce(
        'Best of luck with your backend interview preparation! What areas are you focusing on?',
      );

      const asstMsg = {
        id: 'msg-2',
        conversationId,
        role: Role.ASSISTANT,
        content: 'Best of luck with your backend interview preparation!',
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(asstMsg);

      const result = await agentService.interact(
        conversationId,
        'I am preparing for a backend interview next Friday.',
      );

      expect(result.assistantMessage.content).toContain('backend interview');
      // Verifies that memory processing was called with the user turn
      expect(mockMemoryEngine.processAndStoreMemories).toHaveBeenCalledWith(
        'user-1',
        conversationId,
        'I am preparing for a backend interview next Friday.',
        expect.any(String),
        'msg-1',
        expect.any(Date),
      );
    });

    it('Turn 2: retrieves earlier backend interview memory to guide search for resources', async () => {
      const conversationId = 'conv-turn-2';
      mockConversationRepo.findById.mockResolvedValueOnce({
        id: conversationId,
        title: 'Interview Discussion',
        userId: 'user-1',
      });

      const turn2Query = 'Find some resources for the interview we discussed.';
      const userMsgTurn2 = {
        id: 'msg-3',
        conversationId,
        role: Role.USER,
        content: turn2Query,
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(userMsgTurn2);
      mockMessageRepo.findByConversation.mockResolvedValueOnce([userMsgTurn2]);

      // Internal memory retrieval returns the Turn 1 memory!
      const rememberedInterview = {
        id: 'mem-interview-1',
        type: 'EPISODIC' as const,
        subCategory: 'EVENT' as const,
        content: 'User is preparing for a backend interview next Friday',
        importance: 4.5,
        occurredAt: '2026-11-20T10:00:00.000Z',
        createdAt: new Date().toISOString(),
        score: 0.95,
      };
      mockMemoryEngine.retrieveMemories.mockResolvedValueOnce([rememberedInterview]);

      // LLM receives the disambiguated context and synthesizes response with citations
      mockLLMService.generateWithTools.mockImplementation(async (context: any) => {
        // Verify system prompt has the disambiguation and recalled memory
        const systemPrompt = context.find((c: any) => c.role === 'system')?.content || '';
        expect(systemPrompt).toContain('backend interview');
        expect(systemPrompt).toContain('RECALLED MEMORIES');

        return 'For your upcoming backend interview next Friday, here are recommended resources: [System Design Primer](https://github.com/donnemartin/system-design-primer).';
      });

      const asstMsgTurn2 = {
        id: 'msg-4',
        conversationId,
        role: Role.ASSISTANT,
        content: 'For your upcoming backend interview next Friday...',
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(asstMsgTurn2);

      const result = await agentService.interact(conversationId, turn2Query);

      expect(mockMemoryEngine.retrieveMemories).toHaveBeenCalledWith(
        'user-1',
        turn2Query,
        undefined,
        6,
      );
      expect(result.queryAnalysis.hasImplicitReference).toBe(true);
      expect(result.queryAnalysis.expandedContextSummary).toContain('backend interview');
      expect(result.recalledMemories).toHaveLength(1);
      expect(result.recalledMemories[0].content).toContain('backend interview');
    });
  });
});

