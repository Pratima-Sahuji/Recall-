import { Router } from 'express';
import { MemoryController } from '../controllers/memory.controller';

const router = Router();
const memoryController = new MemoryController();

router.get('/', memoryController.list);
router.post('/', memoryController.create);
router.delete('/:id', memoryController.delete);

export default router;

