import { MessageRepository } from '../../repositories/message.repository';
import { ConversationRepository } from '../../repositories/conversation.repository';
import { LLMService, ToolCallEvent, DEFAULT_SYSTEM_PROMPT } from '../llm.service';
import { MemoryEngineService } from '../memory/memory.service';
import { QueryUnderstandingService } from './queryUnderstanding.service';
import { ContextAssemblerService } from './contextAssembler.service';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { Role } from '@prisma/client';

export const CONTEXT_AWARE_SYSTEM_PROMPT = `${DEFAULT_SYSTEM_PROMPT}

Context-Aware Agent Directives:
1. Memory Continuity: Seamlessly integrate the user's past discussions, preferences, and commitments into your responses.
2. Reference Disambiguation: When the user refers to "the interview", "that project", or "my preference", consult the RECALLED MEMORIES to identify the specific context.
3. Web Search Guidance:
   - When searching for something previously discussed (e.g. "resources for the interview"), formulate your search query using the SPECIFIC facts from memory (e.g. "backend engineer interview preparation guides").
   - NEVER call web_search if the answer can be answered directly using recalled memories or general reasoning.
4. Source Attribution:
   - When stating facts from user memory, frame them naturally (e.g., "Based on your upcoming backend interview next Friday...").
   - When providing external facts, cite the web search sources with markdown links [Title](URL).`;

export class ContextAwareAgentService {
  constructor(
    private messageRepo = new MessageRepository(),
    private conversationRepo = new ConversationRepository(),
    private llmService = new LLMService(),
    private memoryEngine = new MemoryEngineService(),
    private queryUnderstanding = new QueryUnderstandingService(),
    private contextAssembler = new ContextAssemblerService(),
  ) {}

  /**
   * Executes a complete context-aware streaming interaction:
   * 1. Understands user query & extracts temporal/semantic intent.
   * 2. Retrieves internal episodic & semantic memories.
   * 3. Disambiguates references & prioritizes context within token budget.
   * 4. Determines search necessity (disables search for pure memory queries).
   * 5. Streams synthesized response with source attribution.
   * 6. Persists conversation turns & extracts new memories.
   */
  async streamInteraction(
    conversationId: string,
    userContent: string,
    onChunk: (chunk: string) => void,
    onToolEvent?: (event: ToolCallEvent) => void,
    timezoneOffsetMinutes?: number,
  ) {
    if (!userContent || !userContent.trim()) {
      throw new BadRequestError('User message content cannot be empty');
    }

    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with id ${conversationId} not found`);
    }

    // 1. Persist user message in PostgreSQL
    const userMessage = await this.messageRepo.create({
      conversationId,
      role: Role.USER,
      content: userContent.trim(),
    });

    if (conversation.title === 'New Conversation') {
      const generatedTitle =
        userContent.length > 30 ? `${userContent.substring(0, 30)}...` : userContent;
      await this.conversationRepo.updateTitle(conversationId, generatedTitle);
    }

    // 2. Fetch conversation history
    const previousMessages = await this.messageRepo.findByConversation(conversationId);

    // 3. INTERNAL MEMORY RETRIEVAL: Retrieve relevant memories (semantic & episodic)
    const recalledMemories = await this.memoryEngine.retrieveMemories(
      conversation.userId,
      userContent,
      timezoneOffsetMinutes,
      6, // retrieve top 6 candidate memories
    );

    // 4. QUERY UNDERSTANDING: Disambiguate implicit references with recalled memories
    const queryAnalysis = this.queryUnderstanding.analyzeQuery(userContent, recalledMemories);

    // 5. CONTEXT ASSEMBLY & TOKEN BUDGETING
    let systemPrompt = CONTEXT_AWARE_SYSTEM_PROMPT;
    if (queryAnalysis.expandedContextSummary) {
      systemPrompt += `\n[Context Disambiguation]: ${queryAnalysis.expandedContextSummary}`;
    }

    const context = this.contextAssembler.assembleContext(
      systemPrompt,
      recalledMemories,
      previousMessages,
    );

    // 6. STREAM GENERATION WITH ADAPTIVE TOOL LOOP
    let fullResponse = '';
    const stream = this.llmService.streamWithTools(context, onToolEvent);

    for await (const chunk of stream) {
      fullResponse += chunk;
      onChunk(chunk);
    }

    // 7. Persist assistant message in PostgreSQL
    const assistantMessage = await this.messageRepo.create({
      conversationId,
      role: Role.ASSISTANT,
      content: fullResponse || 'No response generated.',
    });

    // 8. ASYNC MEMORY EXTRACTION: Extract new episodic/semantic memories
    this.memoryEngine
      .processAndStoreMemories(
        conversation.userId,
        conversationId,
        userContent,
        fullResponse,
        userMessage.id,
        userMessage.createdAt,
      )
      .catch((err) => console.error('[ContextAwareAgent] Memory extraction error:', err));

    return {
      userMessage,
      assistantMessage,
      recalledMemories,
      queryAnalysis,
    };
  }

  /**
   * Non-streaming interaction for testing & direct REST calls.
   */
  async interact(
    conversationId: string,
    userContent: string,
    onToolEvent?: (event: ToolCallEvent) => void,
    timezoneOffsetMinutes?: number,
  ) {
    if (!userContent || !userContent.trim()) {
      throw new BadRequestError('User message content cannot be empty');
    }

    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with id ${conversationId} not found`);
    }

    const userMessage = await this.messageRepo.create({
      conversationId,
      role: Role.USER,
      content: userContent.trim(),
    });

    if (conversation.title === 'New Conversation') {
      const generatedTitle =
        userContent.length > 30 ? `${userContent.substring(0, 30)}...` : userContent;
      await this.conversationRepo.updateTitle(conversationId, generatedTitle);
    }

    const previousMessages = await this.messageRepo.findByConversation(conversationId);

    const recalledMemories = await this.memoryEngine.retrieveMemories(
      conversation.userId,
      userContent,
      timezoneOffsetMinutes,
      6,
    );

    const queryAnalysis = this.queryUnderstanding.analyzeQuery(userContent, recalledMemories);

    let systemPrompt = CONTEXT_AWARE_SYSTEM_PROMPT;
    if (queryAnalysis.expandedContextSummary) {
      systemPrompt += `\n[Context Disambiguation]: ${queryAnalysis.expandedContextSummary}`;
    }

    const context = this.contextAssembler.assembleContext(
      systemPrompt,
      recalledMemories,
      previousMessages,
    );

    const replyContent = await this.llmService.generateWithTools(context, onToolEvent);

    const assistantMessage = await this.messageRepo.create({
      conversationId,
      role: Role.ASSISTANT,
      content: replyContent,
    });

    await this.memoryEngine.processAndStoreMemories(
      conversation.userId,
      conversationId,
      userContent,
      replyContent,
      userMessage.id,
      userMessage.createdAt,
    );

    return {
      userMessage,
      assistantMessage,
      recalledMemories,
      queryAnalysis,
    };
  }
}

