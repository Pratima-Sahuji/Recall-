import { MessageRepository } from '../repositories/message.repository';
import { ConversationRepository } from '../repositories/conversation.repository';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { Role } from '@prisma/client';

export class MessageService {
  constructor(
    private messageRepo = new MessageRepository(),
    private conversationRepo = new ConversationRepository(),
  ) {}

  async getMessages(conversationId: string) {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with id ${conversationId} not found`);
    }
    return this.messageRepo.findByConversation(conversationId);
  }

  async createMessage(conversationId: string, role: Role, content: string) {
    if (!content || !content.trim()) {
      throw new BadRequestError('Message content cannot be empty');
    }

    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation with id ${conversationId} not found`);
    }

    const message = await this.messageRepo.create({
      conversationId,
      role,
      content: content.trim(),
    });

    // Auto-update conversation title if it's the first user message
    if (conversation.title === 'New Conversation' && role === 'USER') {
      const generatedTitle =
        content.length > 30 ? `${content.substring(0, 30)}...` : content;
      await this.conversationRepo.updateTitle(conversationId, generatedTitle);
    }

    return message;
  }
}

