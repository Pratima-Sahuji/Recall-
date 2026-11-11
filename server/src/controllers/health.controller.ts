import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export class HealthController {
  async getHealth(req: Request, res: Response): Promise<void> {
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'unreachable';
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        api: 'healthy',
        database: dbStatus,
      },
    });
  }
}

