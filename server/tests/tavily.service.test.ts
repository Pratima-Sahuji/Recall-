import { TavilyService } from '../src/services/tavily.service';
import { AppError } from '../src/utils/errors';

// Global fetch mock
const originalFetch = global.fetch;

describe('TavilyService', () => {
  let tavilyService: TavilyService;

  beforeEach(() => {
    tavilyService = new TavilyService('test-tavily-key', 5, 2000);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should throw BadRequest error for empty query', async () => {
      await expect(tavilyService.search('   ')).rejects.toThrow('Search query cannot be empty');
    });

    it('should return parsed results on 200 response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          answer: 'Quantum computers use qubits.',
          results: [
            {
              title: 'Quantum Overview',
              url: 'https://example.com/quantum',
              content: 'A qubit can be in a superposition state.',
              score: 0.95,
            },
          ],
        }),
      } as any);

      const response = await tavilyService.search('quantum computing');

      expect(response.query).toBe('quantum computing');
      expect(response.answer).toBe('Quantum computers use qubits.');
      expect(response.results).toHaveLength(1);
      expect(response.results[0].title).toBe('Quantum Overview');
      expect(response.results[0].url).toBe('https://example.com/quantum');
    });

    it('should handle 401 unauthorized gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      } as any);

      await expect(tavilyService.search('test query')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should handle 429 rate limit / quota exceeded', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Quota exceeded',
      } as any);

      await expect(tavilyService.search('test query')).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });

  describe('formatResultsForLLM', () => {
    it('should format search results with citation numbers, titles, and URLs', () => {
      const mockResults = {
        query: 'latest tech news',
        answer: 'Tech continues to advance.',
        results: [
          {
            title: 'Tech Daily',
            url: 'https://news.example.com/1',
            content: 'New AI model launched.',
            score: 0.9,
          },
        ],
      };

      const formatted = tavilyService.formatResultsForLLM(mockResults);

      expect(formatted).toContain('Search Results for "latest tech news"');
      expect(formatted).toContain('[1] Title: Tech Daily');
      expect(formatted).toContain('URL: https://news.example.com/1');
      expect(formatted).toContain('Snippet: New AI model launched.');
      expect(formatted).toContain('Cite source numbers and exact URLs');
    });

    it('should return fallback message when results are empty', () => {
      const mockResults = {
        query: 'nonexistent keyword xyz123',
        results: [],
      };

      const formatted = tavilyService.formatResultsForLLM(mockResults);
      expect(formatted).toContain('returned 0 results');
    });
  });
});

