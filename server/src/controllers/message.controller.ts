import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { Role } from '@prisma/client';

export class MessageController {
  constructor(private messageService = new MessageService()) {}

  getByConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const messages = await this.messageService.getMessages(conversationId);
      res.json({ status: 'success', data: messages });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { conversationId } = req.params;
      const { role, content } = req.body;
      const parsedRole = (role || 'USER') as Role;
      const message = await this.messageService.createMessage(
        conversationId,
        parsedRole,
        content,
      );
      res.status(201).json({ status: 'success', data: message });
    } catch (err) {
      next(err);
    }
  };
}

