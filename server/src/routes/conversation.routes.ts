import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { MessageController } from '../controllers/message.controller';
import { ChatController } from '../controllers/chat.controller';
import { chatLimiter } from '../middleware/rateLimiter';
import { validateChatMessage } from '../middleware/validateRequest';

const router = Router();
const conversationController = new ConversationController();
const messageController = new MessageController();
const chatController = new ChatController();

router.get('/', conversationController.list);
router.post('/', conversationController.create);
router.get('/:id', conversationController.getById);
router.patch('/:id/title', conversationController.updateTitle);
router.delete('/:id', conversationController.delete);

// Nested message routes
router.get('/:conversationId/messages', messageController.getByConversation);
router.post('/:conversationId/messages', messageController.create);

// AI Chat Engine Endpoints (with rate limiting & payload validation)
router.post('/:conversationId/chat', chatLimiter, validateChatMessage, chatController.chat);
router.post('/:conversationId/chat/stream', chatLimiter, validateChatMessage, chatController.streamChat);

export default router;
