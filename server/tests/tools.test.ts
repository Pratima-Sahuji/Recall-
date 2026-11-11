import { LLMService } from '../src/services/llm.service';
import { AGENT_TOOLS } from '../src/services/tools.schema';
import { TavilyService } from '../src/services/tavily.service';

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

describe('Web Search Tool & Calling Loop', () => {
  let llmService: LLMService;
  let mockTavilyService: jest.Mocked<TavilyService>;
  let mockOpenAIInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTavilyService = {
      search: jest.fn(),
      formatResultsForLLM: jest.fn(),
    } as any;

    llmService = new LLMService(
      'mock-openai-key',
      'gpt-4o-mini',
      5000,
      mockTavilyService,
    );
    mockOpenAIInstance = (llmService as any).client;
  });

  describe('Tool Schema Constraints', () => {
    it('must have exactly one externally callable tool: web_search', () => {
      expect(AGENT_TOOLS).toHaveLength(1);
      expect(AGENT_TOOLS[0].type).toBe('function');
      expect(AGENT_TOOLS[0].function.name).toBe('web_search');
      expect(AGENT_TOOLS[0].function.parameters?.required).toContain('query');
    });
  });

  describe('executeTool', () => {
    it('should reject any tool other than web_search', async () => {
      const result = await llmService.executeTool('database_query', '{}');
      expect(result).toContain("Tool 'database_query' is not supported");
    });

    it('should handle malformed JSON arguments gracefully', async () => {
      const result = await llmService.executeTool('web_search', 'not-json{');
      expect(result).toContain('Malformed JSON arguments');
    });

    it('should reject missing query argument', async () => {
      const result = await llmService.executeTool('web_search', JSON.stringify({}));
      expect(result).toContain("Missing or invalid 'query' argument");
    });

    it('should execute Tavily search on valid arguments', async () => {
      mockTavilyService.search.mockResolvedValueOnce({
        query: 'space telescope',
        results: [
          {
            title: 'Hubble',
            url: 'https://nasa.gov/hubble',
            content: 'Hubble orbits Earth.',
            score: 0.99,
          },
        ],
      });
      mockTavilyService.formatResultsForLLM.mockReturnValueOnce(
        'Formatted Search Results for Hubble',
      );

      const result = await llmService.executeTool(
        'web_search',
        JSON.stringify({ query: 'space telescope' }),
      );

      expect(mockTavilyService.search).toHaveBeenCalledWith('space telescope');
      expect(result).toBe('Formatted Search Results for Hubble');
    });

    it('should handle Tavily execution failures without crashing', async () => {
      mockTavilyService.search.mockRejectedValueOnce(new Error('Tavily timeout error'));

      const result = await llmService.executeTool(
        'web_search',
        JSON.stringify({ query: 'quantum' }),
      );

      expect(result).toContain('Web search failed: Tavily timeout error');
    });
  });

  describe('Tool Selection & Loop Execution', () => {
    it('should answer directly when the model decides no search is needed', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '2 + 2 is 4.',
              tool_calls: null,
            },
          },
        ],
      });

      const messages = [{ role: 'user' as const, content: 'What is 2 + 2?' }];
      const response = await llmService.generateWithTools(messages);

      expect(response).toBe('2 + 2 is 4.');
      expect(mockTavilyService.search).not.toHaveBeenCalled();
    });

    it('should invoke web_search, pass results to model, and synthesize response with citations', async () => {
      // Step 1: Model calls web_search
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'web_search',
                    arguments: JSON.stringify({ query: 'current Mars rover status' }),
                  },
                },
              ],
            },
          },
        ],
      });

      // Mock Tavily results
      mockTavilyService.search.mockResolvedValueOnce({
        query: 'current Mars rover status',
        results: [
          {
            title: 'Perseverance Mission',
            url: 'https://mars.nasa.gov/perseverance',
            content: 'Perseverance is actively collecting core samples in Jezero Crater.',
            score: 0.98,
          },
        ],
      });
      mockTavilyService.formatResultsForLLM.mockReturnValueOnce(
        'Source [1]: Perseverance is active at Jezero Crater (https://mars.nasa.gov/perseverance)',
      );

      // Step 2: Model synthesizes answer with citation
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'The Perseverance rover is actively collecting samples [NASA](https://mars.nasa.gov/perseverance).',
            },
          },
        ],
      });

      const messages = [{ role: 'user' as const, content: 'What is the Mars rover doing today?' }];
      const toolEvents: any[] = [];
      const response = await llmService.generateWithTools(messages, (e) => toolEvents.push(e));

      expect(mockTavilyService.search).toHaveBeenCalledWith('current Mars rover status');
      expect(toolEvents).toHaveLength(2);
      expect(toolEvents[0]).toEqual({
        tool: 'web_search',
        query: 'current Mars rover status',
        status: 'searching',
      });
      expect(toolEvents[1]).toEqual({
        tool: 'web_search',
        query: 'current Mars rover status',
        status: 'completed',
      });
      expect(response).toContain('https://mars.nasa.gov/perseverance');
    });

    it('should prevent infinite tool-calling loops with maxIterations guard', async () => {
      // Model keeps returning tool calls endlessly
      mockOpenAIInstance.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'loop_call',
                  type: 'function',
                  function: {
                    name: 'web_search',
                    arguments: JSON.stringify({ query: 'loop query' }),
                  },
                },
              ],
            },
          },
        ],
      });

      mockTavilyService.search.mockResolvedValue({
        query: 'loop query',
        results: [],
      });
      mockTavilyService.formatResultsForLLM.mockReturnValue('no results');

      const messages = [{ role: 'user' as const, content: 'Infinite loop prompt' }];
      const response = await llmService.generateWithTools(messages, undefined, 2);

      expect(response).toContain('maximum tool iterations reached');
    });
  });
});

