import { ConversationRepository } from '../repositories/conversation.repository';
import { UserRepository } from '../repositories/user.repository';
import { NotFoundError } from '../utils/errors';

export class ConversationService {
  constructor(
    private conversationRepo = new ConversationRepository(),
    private userRepo = new UserRepository(),
  ) {}

  async listUserConversations(userId?: string) {
    let targetUserId = userId;
    if (!targetUserId) {
      const defaultUser = await this.userRepo.getOrCreateDefaultUser();
      targetUserId = defaultUser.id;
    }
    return this.conversationRepo.listByUser(targetUserId);
  }

  async getConversation(id: string) {
    const conversation = await this.conversationRepo.findById(id);
    if (!conversation) {
      throw new NotFoundError(`Conversation with id ${id} not found`);
    }
    return conversation;
  }

  async createConversation(userId?: string, title?: string) {
    let targetUserId = userId;
    if (!targetUserId) {
      const defaultUser = await this.userRepo.getOrCreateDefaultUser();
      targetUserId = defaultUser.id;
    }
    return this.conversationRepo.create({
      userId: targetUserId,
      title: title || 'New Conversation',
    });
  }

  async updateConversationTitle(id: string, title: string) {
    await this.getConversation(id);
    return this.conversationRepo.updateTitle(id, title);
  }

  async deleteConversation(id: string) {
    await this.getConversation(id);
    return this.conversationRepo.delete(id);
  }
}

