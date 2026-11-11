import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { AGENT_TOOLS } from './tools.schema';
import { TavilyService } from './tavily.service';

export interface ChatMessageContext {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ToolCallEvent {
  tool: string;
  query: string;
  status: 'searching' | 'completed' | 'failed';
  resultCount?: number;
}

export const DEFAULT_SYSTEM_PROMPT = `You are Recall, an intelligent AI agent.

Strict Guidelines:
1. Use the 'web_search' tool ONLY when the user's question requires real-time information, recent events, breaking news, or specific factual verification beyond your training data.
2. Do NOT use 'web_search' for common knowledge, coding, math, general reasoning, or conversational chit-chat.
3. When using web search results:
   - Provide accurate, synthesized answers.
   - You MUST include inline citations with exact URLs provided in the results, formatted in markdown: [Source Title](URL).
   - NEVER invent or hallucinate URLs or citations.
   - Clearly distinguish verified facts found in the search results from unverified assumptions.
   - If search returns no relevant results, honestly inform the user.`;

export class LLMService {
  private client: OpenAI | null = null;
  private model: string;
  private timeoutMs: number;
  private tavilyService: TavilyService;
  private apiKey: string;

  constructor(
    apiKey?: string,
    model?: string,
    timeoutMs?: number,
    tavilyService?: TavilyService,
  ) {
    this.apiKey = apiKey || config.llm.apiKey;
    this.model = model || config.llm.model;
    this.timeoutMs = timeoutMs || config.llm.timeoutMs;
    this.tavilyService = tavilyService || new TavilyService();

    if (this.apiKey && !this.isGemini()) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: config.llm.baseURL,
        timeout: this.timeoutMs,
      });
    }
  }

  private isGemini(): boolean {
    return (
      (this.apiKey.startsWith('AQ.') || this.apiKey.startsWith('AIzaSy') || config.llm.provider === 'gemini') &&
      !this.apiKey.startsWith('gsk_')
    );
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      if (!this.apiKey) {
        throw new AppError(
          'API key is missing. Please set GROQ_API_KEY (free) or OPENAI_API_KEY in server/.env.',
          500,
        );
      }
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: config.llm.baseURL,
        timeout: this.timeoutMs,
      });
    }
    return this.client;
  }

  constructContext(
    history: Array<{ role: string; content: string }>,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxHistoryMessages = 20,
    memoryContext?: string,
  ): ChatMessageContext[] {
    const fullSystemPrompt = memoryContext
      ? `${systemPrompt}\n\n${memoryContext}`
      : systemPrompt;

    const context: ChatMessageContext[] = [{ role: 'system', content: fullSystemPrompt }];
    const recentHistory = history.slice(-maxHistoryMessages);

    for (const msg of recentHistory) {
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

  /**
   * Safe execution of the web_search tool with argument parsing,
   * error isolation, and formatting.
   */
  async executeTool(name: string, rawArgs: string): Promise<string> {
    if (name !== 'web_search') {
      return `Error: Tool '${name}' is not supported. The only allowed tool is 'web_search'.`;
    }

    let parsedArgs: { query?: string };
    try {
      parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    } catch {
      return `Error: Malformed JSON arguments provided for tool '${name}'. Argument must be {"query": "search query"}.`;
    }

    if (!parsedArgs.query || typeof parsedArgs.query !== 'string' || !parsedArgs.query.trim()) {
      return `Error: Missing or invalid 'query' argument for web_search.`;
    }

    try {
      const searchResponse = await this.tavilyService.search(parsedArgs.query.trim());
      return this.tavilyService.formatResultsForLLM(searchResponse);
    } catch (err: any) {
      console.error('[LLMService] Web search execution failed:', err.message);
      return `Web search failed: ${err.message || 'Unknown error'}. Please answer based on your knowledge if appropriate and inform the user that search was unavailable.`;
    }
  }

  /**
   * Generates a streaming response with tool calling support.
   * Seamlessly supports both Google Gemini and OpenAI.
   */
  async *streamWithTools(
    messages: ChatMessageContext[],
    onToolEvent?: (event: ToolCallEvent) => void,
    maxIterations = 3,
  ): AsyncGenerator<string, void, unknown> {
    if (this.isGemini()) {
      yield* this.streamGemini(messages, onToolEvent);
      return;
    }

    // Standard OpenAI implementation
    const openai = this.ensureClient();
    const workingMessages: ChatCompletionMessageParam[] = messages.map((m) => {
      const base: any = { role: m.role, content: m.content };
      if (m.name) base.name = m.name;
      if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
      if (m.tool_calls) base.tool_calls = m.tool_calls;
      return base;
    });

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      let response;
      try {
        response = await openai.chat.completions.create({
          model: this.model,
          messages: workingMessages,
          tools: AGENT_TOOLS,
          tool_choice: 'auto',
          temperature: 0.7,
        });
      } catch (err: any) {
        this.handleOpenAIError(err);
      }

      const choice = response.choices?.[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        throw new AppError('Received empty choice from OpenAI completion', 502);
      }

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        if (assistantMessage.content) {
          yield assistantMessage.content;
        }
        return;
      }

      workingMessages.push(assistantMessage);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = toolCall.function.arguments;

        let query = '';
        try {
          const parsed = JSON.parse(functionArgs);
          query = parsed.query || '';
        } catch {
          query = functionArgs;
        }

        onToolEvent?.({
          tool: functionName,
          query,
          status: 'searching',
        });

        const toolResult = await this.executeTool(functionName, functionArgs);

        onToolEvent?.({
          tool: functionName,
          query,
          status: 'completed',
        });

        workingMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      try {
        const stream = await openai.chat.completions.create({
          model: this.model,
          messages: workingMessages,
          stream: true,
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        }
        return;
      } catch (err: any) {
        this.handleOpenAIError(err);
      }
    }

    yield 'Unable to complete request: maximum tool iterations reached.';
  }

  /**
   * Native Google Gemini streaming handler with Tavily web search integration.
   */
  private async *streamGemini(
    messages: ChatMessageContext[],
    onToolEvent?: (event: ToolCallEvent) => void,
  ): AsyncGenerator<string, void, unknown> {
    const systemMessage = messages.find((m) => m.role === 'system')?.content || DEFAULT_SYSTEM_PROMPT;
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const lastUserMessage = conversationMessages[conversationMessages.length - 1]?.content || '';

    // Check if web search is needed
    const needsSearch =
      /\b(find|search|look\s+up|latest|news|resources|today|current|recent)\b/i.test(lastUserMessage) &&
      !/\bwhat\s+did\s+i\s+(ask|say|mention)\b/i.test(lastUserMessage);

    let searchContext = '';
    if (needsSearch) {
      onToolEvent?.({
        tool: 'web_search',
        query: lastUserMessage,
        status: 'searching',
      });

      const searchResult = await this.executeTool('web_search', JSON.stringify({ query: lastUserMessage }));

      onToolEvent?.({
        tool: 'web_search',
        query: lastUserMessage,
        status: 'completed',
      });

      searchContext = `\n\n${searchResult}`;
    }

    // Map to Gemini contents
    const contents: any[] = [];
    for (const msg of conversationMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Attach search context to user prompt if search was run
    if (searchContext && contents.length > 0) {
      const lastIndex = contents.length - 1;
      contents[lastIndex].parts[0].text += `\n\n[Search Information Provided]:${searchContext}`;
    }

    const effectiveModel = this.model.includes('gemini') ? this.model : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemMessage }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new AppError(`Gemini API error (${response.status}): ${errBody}`, response.status);
    }

    if (!response.body) {
      throw new AppError('Gemini response has no readable stream', 502);
    }

    const reader = (response.body as any).getReader
      ? (response.body as any).getReader()
      : null;

    if (reader) {
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  yield text;
                }
              } catch {
                // partial line
              }
            }
          }
        }
      }
    } else {
      // Node.js fallback stream
      for await (const chunk of response.body as any) {
        const str = chunk.toString();
        for (const line of str.split('\n')) {
          if (line.startsWith('data:')) {
            const dataStr = line.replace('data:', '').trim();
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) yield text;
              } catch {
                // ignore
              }
            }
          }
        }
      }
    }
  }

  /**
   * Non-streaming response handling for direct REST requests & tests.
   */
  async generateWithTools(
    messages: ChatMessageContext[],
    onToolEvent?: (event: ToolCallEvent) => void,
    maxIterations = 3,
  ): Promise<string> {
    if (this.isGemini()) {
      let full = '';
      for await (const chunk of this.streamGemini(messages, onToolEvent)) {
        full += chunk;
      }
      return full;
    }

    const openai = this.ensureClient();
    const workingMessages: ChatCompletionMessageParam[] = messages.map((m) => {
      const base: any = { role: m.role, content: m.content };
      if (m.name) base.name = m.name;
      if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
      if (m.tool_calls) base.tool_calls = m.tool_calls;
      return base;
    });

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      let response;
      try {
        response = await openai.chat.completions.create({
          model: this.model,
          messages: workingMessages,
          tools: AGENT_TOOLS,
          tool_choice: iterations === maxIterations ? 'none' : 'auto',
          temperature: 0.7,
        });
      } catch (err: any) {
        this.handleOpenAIError(err);
      }

      const choice = response.choices?.[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        throw new AppError('Received empty choice from OpenAI completion', 502);
      }

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return assistantMessage.content || '';
      }

      workingMessages.push(assistantMessage);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = toolCall.function.arguments;

        let query = '';
        try {
          const parsed = JSON.parse(functionArgs);
          query = parsed.query || '';
        } catch {
          query = functionArgs;
        }

        onToolEvent?.({
          tool: functionName,
          query,
          status: 'searching',
        });

        const toolResult = await this.executeTool(functionName, functionArgs);

        onToolEvent?.({
          tool: functionName,
          query,
          status: 'completed',
        });

        workingMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    return 'Unable to complete request: maximum tool iterations reached.';
  }

  async generateResponse(messages: ChatMessageContext[]): Promise<string> {
    return this.generateWithTools(messages);
  }

  async *streamResponse(messages: ChatMessageContext[]): AsyncGenerator<string, void, unknown> {
    yield* this.streamWithTools(messages);
  }

  private handleOpenAIError(error: any): never {
    console.error('[LLMService] Error:', error?.message || error);

    if (error instanceof AppError) {
      throw error;
    }

    if (error.name === 'APIConnectionTimeoutError' || error.code === 'ETIMEDOUT') {
      throw new AppError('Request timed out. Please try again.', 504);
    }

    if (error.status === 401) {
      throw new AppError('Invalid or unauthorized API key.', 401);
    }

    if (error.status === 429) {
      throw new AppError('Rate limit or quota exceeded. Please check your plan.', 429);
    }

    if (error.status && error.status >= 500) {
      throw new AppError('Service is temporarily unavailable. Try again shortly.', 502);
    }

    throw new AppError(error.message || 'Failed to generate response.', error.status || 500);
  }
}
