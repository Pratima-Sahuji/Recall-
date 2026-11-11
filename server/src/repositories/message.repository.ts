import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';

export class MessageRepository {
  async create(data: { conversationId: string; role: Role; content: string }) {
    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
      },
    });

    // Touch conversation updated timestamp
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async findByConversation(conversationId: string) {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.message.findUnique({
      where: { id },
    });
  }
}

