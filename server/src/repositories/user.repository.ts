import { prisma } from '../config/prisma';

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: { email?: string; name?: string }) {
    return prisma.user.create({
      data,
    });
  }

  async getOrCreateDefaultUser() {
    const existing = await prisma.user.findFirst();
    if (existing) return existing;

    return prisma.user.create({
      data: {
        name: 'Default User',
        email: 'user@example.com',
      },
    });
  }
}

