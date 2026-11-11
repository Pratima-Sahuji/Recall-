import { MessageRepository } from '../repositories/message.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { LLMService, ToolCallEvent } from './llm.service';
import { MemoryEngineService } from './memory/memory.service';
import { ContextAwareAgentService } from './agent/contextAwareAgent.service';

export class ChatService {
  private agentService: ContextAwareAgentService;

  constructor(
    private messageRepo = new MessageRepository(),
    private conversationRepo = new ConversationRepository(),
    private llmService = new LLMService(),
    private memoryEngine = new MemoryEngineService(),
    agentService?: ContextAwareAgentService,
  ) {
    this.agentService =
      agentService ||
      new ContextAwareAgentService(
        this.messageRepo,
        this.conversationRepo,
        this.llmService,
        this.memoryEngine,
      );
  }

  /**
   * Delegates to ContextAwareAgentService for intelligent context assembly,
   * memory retrieval, query understanding, and search execution.
   */
  async streamChat(
    conversationId: string,
    userContent: string,
    onChunk: (chunk: string) => void,
    onToolEvent?: (event: ToolCallEvent) => void,
    timezoneOffsetMinutes?: number,
  ) {
    return this.agentService.streamInteraction(
      conversationId,
      userContent,
      onChunk,
      onToolEvent,
      timezoneOffsetMinutes,
    );
  }

  /**
   * Non-streaming context-aware interaction.
   */
  async chat(
    conversationId: string,
    userContent: string,
    onToolEvent?: (event: ToolCallEvent) => void,
    timezoneOffsetMinutes?: number,
  ) {
    return this.agentService.interact(
      conversationId,
      userContent,
      onToolEvent,
      timezoneOffsetMinutes,
    );
  }
}
