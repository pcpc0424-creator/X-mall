import { Router } from 'express';
import { pointController } from '../controllers/point.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protected routes
router.get('/summary', authenticateUser, (req, res) => pointController.getSummary(req, res));
router.get('/history', authenticateUser, (req, res) => pointController.getHistory(req, res));
router.post('/transfer', authenticateUser, (req, res) => pointController.transfer(req, res));

export default router;
