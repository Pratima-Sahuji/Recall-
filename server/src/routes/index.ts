import { Router } from 'express';
import healthRoutes from './health.routes';
import conversationRoutes from './conversation.routes';
import messageRoutes from './message.routes';
import memoryRoutes from './memory.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/memories', memoryRoutes);

export default router;

