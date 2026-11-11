import { Router } from 'express';
import { MessageController } from '../controllers/message.controller';

const router = Router();
const messageController = new MessageController();

router.get('/conversation/:conversationId', messageController.getByConversation);
router.post('/conversation/:conversationId', messageController.create);

export default router;

