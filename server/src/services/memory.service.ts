import { MemoryRepository } from '../repositories/memory.repository';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError } from '../utils/errors';
import { MemoryCategory } from '@prisma/client';

export class MemoryService {
  constructor(
    private memoryRepo = new MemoryRepository(),
    private userRepo = new UserRepository(),
  ) {}

  async listUserMemories(userId?: string) {
    let targetUserId = userId;
    if (!targetUserId) {
      const defaultUser = await this.userRepo.getOrCreateDefaultUser();
      targetUserId = defaultUser.id;
    }
    return this.memoryRepo.findByUser(targetUserId);
  }

  async createMemory(data: {
    userId?: string;
    conversationId?: string;
    content: string;
    category?: MemoryCategory;
    importance?: number;
  }) {
    if (!data.content || !data.content.trim()) {
      throw new BadRequestError('Memory content cannot be empty');
    }

    let targetUserId = data.userId;
    if (!targetUserId) {
      const defaultUser = await this.userRepo.getOrCreateDefaultUser();
      targetUserId = defaultUser.id;
    }

    return this.memoryRepo.create({
      userId: targetUserId,
      conversationId: data.conversationId,
      content: data.content.trim(),
      category: data.category,
      importance: data.importance,
    });
  }

  async deleteMemory(id: string) {
    return this.memoryRepo.delete(id);
  }
}

