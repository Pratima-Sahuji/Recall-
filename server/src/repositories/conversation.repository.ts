import { prisma } from '../config/prisma';

export class ConversationRepository {
  async findById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async listByUser(userId: string) {
    return prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async create(data: { userId: string; title?: string }) {
    return prisma.conversation.create({
      data: {
        userId: data.userId,
        title: data.title || 'New Conversation',
      },
    });
  }

  async updateTitle(id: string, title: string) {
    return prisma.conversation.update({
      where: { id },
      data: { title },
    });
  }

  async delete(id: string) {
    return prisma.conversation.delete({
      where: { id },
    });
  }
}

