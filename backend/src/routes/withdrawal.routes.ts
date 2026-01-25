import { Router } from 'express';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protected routes
router.post('/', authenticateUser, (req, res) => withdrawalController.createRequest(req, res));
router.get('/', authenticateUser, (req, res) => withdrawalController.getUserWithdrawals(req, res));

export default router;
