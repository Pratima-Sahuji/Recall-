import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/conversation.service';

export class ConversationController {
  constructor(private conversationService = new ConversationService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const conversations = await this.conversationService.listUserConversations(userId);
      res.json({ status: 'success', data: conversations });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const conversation = await this.conversationService.getConversation(id);
      res.json({ status: 'success', data: conversation });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, title } = req.body;
      const conversation = await this.conversationService.createConversation(userId, title);
      res.status(201).json({ status: 'success', data: conversation });
    } catch (err) {
      next(err);
    }
  };

  updateTitle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      const updated = await this.conversationService.updateConversationTitle(id, title);
      res.json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.conversationService.deleteConversation(id);
      res.json({ status: 'success', message: 'Conversation deleted successfully' });
    } catch (err) {
      next(err);
    }
  };
}

