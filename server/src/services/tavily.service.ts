import { config } from '../config';
import { AppError } from '../utils/errors';
import { sanitizeUntrustedContent, wrapInUntrustedBoundary } from '../utils/security';

export interface TavilyResultItem {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilyResultItem[];
}

export class TavilyService {
  private apiKey: string;
  private maxResults: number;
  private timeoutMs: number;

  constructor(apiKey?: string, maxResults?: number, timeoutMs?: number) {
    this.apiKey = apiKey || config.tavily.apiKey;
    this.maxResults = maxResults || config.tavily.maxResults;
    this.timeoutMs = timeoutMs || config.tavily.timeoutMs;
  }

  /**
   * Executes a search against Tavily Search API with timeout and retry logic.
   */
  async search(query: string, maxResultsOverride?: number): Promise<TavilySearchResponse> {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
      throw new AppError('Search query cannot be empty', 400);
    }

    if (!this.apiKey) {
      throw new AppError(
        'Tavily API key is missing. Please set TAVILY_API_KEY in server/.env',
        500,
      );
    }

    const effectiveMaxResults = maxResultsOverride || this.maxResults;
    const maxRetries = 2;
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: this.apiKey,
            query: trimmedQuery,
            search_depth: 'basic',
            include_answer: true,
            max_results: effectiveMaxResults,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          if (response.status === 401) {
            throw new AppError('Invalid or unauthorized Tavily API key.', 401);
          }
          if (response.status === 429) {
            throw new AppError('Tavily API rate limit or quota exceeded.', 429);
          }
          // For 5xx errors, retry if attempts remain
          if (response.status >= 500 && attempt <= maxRetries) {
            console.warn(`[TavilyService] 5xx received (${response.status}), retrying attempt ${attempt}...`);
            await new Promise((res) => setTimeout(res, 1000 * attempt));
            continue;
          }
          throw new AppError(
            `Tavily search failed: ${response.status} ${response.statusText} ${errorBody}`,
            response.status,
          );
        }

        const data = (await response.json()) as any;

        const results: TavilyResultItem[] = (data.results || []).map((r: any) => ({
          title: r.title || 'Untitled',
          url: r.url || '',
          content: r.content || '',
          score: typeof r.score === 'number' ? r.score : 0,
        }));

        return {
          query: trimmedQuery,
          answer: data.answer,
          results,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
          lastError = new AppError(
            `Tavily search timed out after ${this.timeoutMs}ms`,
            504,
          );
        } else {
          lastError = err;
        }

        // Retry on network errors or timeouts if attempts remain
        if (attempt <= maxRetries && (err.name === 'AbortError' || err.code === 'ECONNRESET')) {
          console.warn(`[TavilyService] Network error, retrying attempt ${attempt}...`);
          await new Promise((res) => setTimeout(res, 1000 * attempt));
          continue;
        }

        break;
      }
    }

    throw lastError || new AppError('Tavily search request failed', 500);
  }

  /**
   * Formats search results into a clean text block for LLM synthesis.
   * Ensures citation anchors and exact source URLs are provided.
   */
  formatResultsForLLM(searchResponse: TavilySearchResponse): string {
    if (!searchResponse.results || searchResponse.results.length === 0) {
      return `Web search for "${searchResponse.query}" returned 0 results. Please inform the user that no relevant web results were found.`;
    }

    let text = `Search Results for "${searchResponse.query}":\n`;
    if (searchResponse.answer) {
      text += `\nQuick Summary from Tavily: ${searchResponse.answer}\n`;
    }

    text += `\nSources:\n`;
    searchResponse.results.forEach((item, index) => {
      const cleanTitle = sanitizeUntrustedContent(item.title);
      const cleanContent = sanitizeUntrustedContent(item.content);
      text += `[${index + 1}] Title: ${cleanTitle}\n`;
      text += `    URL: ${item.url}\n`;
      text += `    Snippet: ${wrapInUntrustedBoundary(cleanContent)}\n\n`;
    });

    text += `Instructions for synthesis:\n`;
    text += `- Cite source numbers and exact URLs (e.g. "[1](url)").\n`;
    text += `- Do NOT invent facts or citations not present in the snippets.\n`;
    text += `- Clearly distinguish retrieved facts from unsupported claims.\n`;

    return text;
  }
}

