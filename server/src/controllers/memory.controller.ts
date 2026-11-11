import { Request, Response, NextFunction } from 'express';
import { MemoryService } from '../services/memory.service';

export class MemoryController {
  constructor(private memoryService = new MemoryService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const memories = await this.memoryService.listUserMemories(userId);
      res.json({ status: 'success', data: memories });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const memory = await this.memoryService.createMemory(req.body);
      res.status(201).json({ status: 'success', data: memory });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.memoryService.deleteMemory(id);
      res.json({ status: 'success', message: 'Memory deleted' });
    } catch (err) {
      next(err);
    }
  };
}

