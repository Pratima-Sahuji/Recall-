import { LLMService } from '../src/services/llm.service';
import { AppError } from '../src/utils/errors';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
  });
});

describe('LLMService', () => {
  let llmService: LLMService;
  let mockOpenAIInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    llmService = new LLMService('test-api-key', 'gpt-4o-mini', 5000);
    // Access private client created by constructor
    mockOpenAIInstance = (llmService as any).client;
  });

  describe('constructContext', () => {
    it('should prepend system prompt and map user/assistant roles', () => {
      const history = [
        { role: 'USER', content: 'Hello agent' },
        { role: 'ASSISTANT', content: 'Hello user' },
      ];

      const context = llmService.constructContext(history, 'Custom system prompt', 10);

      expect(context).toHaveLength(3);
      expect(context[0]).toEqual({ role: 'system', content: 'Custom system prompt' });
      expect(context[1]).toEqual({ role: 'user', content: 'Hello agent' });
      expect(context[2]).toEqual({ role: 'assistant', content: 'Hello user' });
    });

    it('should truncate older messages when history exceeds maxHistoryMessages', () => {
      const history = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'USER' : 'ASSISTANT',
        content: `Message ${i}`,
      }));

      const context = llmService.constructContext(history, 'System', 5);

      // System message (1) + last 5 messages = 6 messages
      expect(context).toHaveLength(6);
      expect(context[0].role).toBe('system');
      expect(context[1].content).toBe('Message 25');
      expect(context[5].content).toBe('Message 29');
    });
  });

  describe('generateResponse', () => {
    it('should return assistant content on successful completion', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: { content: 'Hello, how can I help you today?' },
          },
        ],
      });

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      const response = await llmService.generateResponse(messages);

      expect(response).toBe('Hello, how can I help you today?');
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      );
    });

    it('should throw AppError with 502 when response choice is empty', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [],
      });

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      await expect(llmService.generateResponse(messages)).rejects.toThrow(AppError);
    });

    it('should handle timeout error appropriately (504)', async () => {
      const timeoutError: any = new Error('Connection timeout');
      timeoutError.name = 'APIConnectionTimeoutError';
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(timeoutError);

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      await expect(llmService.generateResponse(messages)).rejects.toMatchObject({
        statusCode: 504,
      });
    });

    it('should handle authentication error (401)', async () => {
      const authError: any = new Error('Incorrect API key provided');
      authError.status = 401;
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(authError);

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      await expect(llmService.generateResponse(messages)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should handle rate limit error (429)', async () => {
      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(rateLimitError);

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      await expect(llmService.generateResponse(messages)).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('streamResponse', () => {
    it('should yield chunks as received from the OpenAI stream', async () => {
      async function* fakeStream() {
        yield { choices: [{ delta: { content: 'Rec' } }] };
        yield { choices: [{ delta: { content: 'all ' } }] };
        yield { choices: [{ delta: { content: 'Agent' } }] };
      }

      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(fakeStream());

      const chunks: string[] = [];
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      for await (const chunk of llmService.streamResponse(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Rec', 'all ', 'Agent']);
    });
  });
});

