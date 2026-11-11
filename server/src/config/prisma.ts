import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✓ Successfully connected to PostgreSQL database via Prisma');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
  }
}

