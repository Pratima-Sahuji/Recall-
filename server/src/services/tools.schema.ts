import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Exactly ONE externally callable tool: web_search.
 * Explicitly instructs the LLM on when and when NOT to call search.
 */
export const WEB_SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Searches the live web for up-to-date facts, breaking news, recent events, current weather, stock quotes, or real-time verification. Use ONLY when the user asks for current or live information that cannot be reliably answered from general knowledge. Do NOT call this tool for general conversational queries, logic, greetings, math, or well-established concepts.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The specific, targeted search query string to search on the web.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

export const AGENT_TOOLS: ChatCompletionTool[] = [WEB_SEARCH_TOOL];

