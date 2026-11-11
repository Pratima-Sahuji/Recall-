import { prisma } from '../config/prisma';
import { MemoryCategory } from '@prisma/client';

export class MemoryRepository {
  async create(data: {
    userId: string;
    conversationId?: string;
    content: string;
    category?: MemoryCategory;
    importance?: number;
  }) {
    return prisma.memory.create({
      data: {
        userId: data.userId,
        conversationId: data.conversationId,
        content: data.content,
        category: data.category || 'FACT',
        importance: data.importance || 1.0,
      },
    });
  }

  async findByUser(userId: string) {
    return prisma.memory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string) {
    return prisma.memory.delete({
      where: { id },
    });
  }
}

