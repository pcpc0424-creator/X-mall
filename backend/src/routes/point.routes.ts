import { Router } from 'express';
import { pointController } from '../controllers/point.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protected routes
router.get('/summary', authenticateUser, (req, res) => pointController.getSummary(req, res));
router.get('/history', authenticateUser, (req, res) => pointController.getHistory(req, res));
// Transfer route removed - P/C/T no longer supported

export default router;
