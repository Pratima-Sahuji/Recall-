import { ChatService } from '../src/services/chat.service';
import { Role } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../src/utils/errors';

describe('ChatService', () => {
  let chatService: ChatService;
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
      constructContext: jest.fn(),
      generateWithTools: jest.fn(),
      streamWithTools: jest.fn(),
    };

    mockMemoryEngine = {
      retrieveMemories: jest.fn().mockResolvedValue([]),
      formatMemoriesForContext: jest.fn().mockReturnValue(''),
      processAndStoreMemories: jest.fn().mockResolvedValue([]),
    };

    chatService = new ChatService(
      mockMessageRepo,
      mockConversationRepo,
      mockLLMService,
      mockMemoryEngine,
    );
  });

  describe('streamChat', () => {
    const conversationId = 'conv-123';
    const userPrompt = 'Explain quantum computing in one sentence.';

    it('should throw BadRequestError if message content is empty', async () => {
      await expect(
        chatService.streamChat(conversationId, '   ', jest.fn()),
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if conversation does not exist', async () => {
      mockConversationRepo.findById.mockResolvedValueOnce(null);

      await expect(
        chatService.streamChat('non-existent-id', userPrompt, jest.fn()),
      ).rejects.toThrow(NotFoundError);
    });

    it('should persist user message, retrieve context & memories, stream chunks, and persist assistant message', async () => {
      const mockConv = {
        id: conversationId,
        title: 'New Conversation',
        userId: 'user-1',
      };
      mockConversationRepo.findById.mockResolvedValueOnce(mockConv);

      const mockSavedUserMsg = {
        id: 'msg-user-1',
        conversationId,
        role: Role.USER,
        content: userPrompt,
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(mockSavedUserMsg);

      const mockHistory = [mockSavedUserMsg];
      mockMessageRepo.findByConversation.mockResolvedValueOnce(mockHistory);

      const mockContext = [
        { role: 'system', content: 'You are Recall...' },
        { role: 'user', content: userPrompt },
      ];
      mockLLMService.constructContext.mockReturnValueOnce(mockContext);

      // Async generator for streaming with tools
      async function* fakeStream() {
        yield 'Quantum ';
        yield 'physics ';
        yield 'rules.';
      }
      mockLLMService.streamWithTools.mockReturnValueOnce(fakeStream());

      const mockSavedAssistantMsg = {
        id: 'msg-asst-1',
        conversationId,
        role: Role.ASSISTANT,
        content: 'Quantum physics rules.',
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(mockSavedAssistantMsg);

      const receivedChunks: string[] = [];
      const onChunk = (chunk: string) => receivedChunks.push(chunk);

      const result = await chatService.streamChat(conversationId, userPrompt, onChunk);

      // Verify user message persistence
      expect(mockMessageRepo.create).toHaveBeenNthCalledWith(1, {
        conversationId,
        role: Role.USER,
        content: userPrompt,
      });

      // Verify internal memory retrieval before generation
      expect(mockMemoryEngine.retrieveMemories).toHaveBeenCalledWith(
        'user-1',
        userPrompt,
        undefined,
        expect.any(Number),
      );

      // Verify context construction from history
      expect(mockMessageRepo.findByConversation).toHaveBeenCalledWith(conversationId);

      // Verify chunks were received
      expect(receivedChunks).toEqual(['Quantum ', 'physics ', 'rules.']);

      // Verify assistant message persistence with full aggregated content
      expect(mockMessageRepo.create).toHaveBeenNthCalledWith(2, {
        conversationId,
        role: Role.ASSISTANT,
        content: 'Quantum physics rules.',
      });

      expect(result.userMessage).toEqual(mockSavedUserMsg);
      expect(result.assistantMessage).toEqual(mockSavedAssistantMsg);
    });
  });

  describe('chat (non-streaming)', () => {
    const conversationId = 'conv-456';
    const userPrompt = 'Hello Recall';

    it('should correctly handle complete request, retrieve memories, and persist both messages', async () => {
      mockConversationRepo.findById.mockResolvedValueOnce({
        id: conversationId,
        title: 'Existing Chat',
        userId: 'user-1',
      });

      const mockSavedUserMsg = {
        id: 'msg-u-1',
        conversationId,
        role: Role.USER,
        content: userPrompt,
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(mockSavedUserMsg);

      mockMessageRepo.findByConversation.mockResolvedValueOnce([mockSavedUserMsg]);
      mockLLMService.constructContext.mockReturnValueOnce([
        { role: 'user', content: userPrompt },
      ]);
      mockLLMService.generateWithTools.mockResolvedValueOnce('Hello! How can I assist you?');

      const mockSavedAssistantMsg = {
        id: 'msg-a-1',
        conversationId,
        role: Role.ASSISTANT,
        content: 'Hello! How can I assist you?',
        createdAt: new Date(),
      };
      mockMessageRepo.create.mockResolvedValueOnce(mockSavedAssistantMsg);

      const result = await chatService.chat(conversationId, userPrompt);

      expect(mockMemoryEngine.retrieveMemories).toHaveBeenCalledWith(
        'user-1',
        userPrompt,
        undefined,
        expect.any(Number),
      );
      expect(result.userMessage.content).toBe(userPrompt);
      expect(result.assistantMessage.content).toBe('Hello! How can I assist you?');
      expect(mockMessageRepo.create).toHaveBeenCalledTimes(2);
    });
  });
});
