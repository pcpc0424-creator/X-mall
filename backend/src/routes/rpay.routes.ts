import { Router } from 'express';
import { rpayController } from '../controllers/rpay.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protected routes
router.get('/balance', authenticateUser, (req, res) => rpayController.getBalance(req, res));
router.get('/history', authenticateUser, (req, res) => rpayController.getHistory(req, res));
router.post('/charge', authenticateUser, (req, res) => rpayController.chargeByCard(req, res));

export default router;
