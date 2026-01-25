import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protected routes
router.get('/profile', authenticateUser, (req, res) => userController.getProfile(req, res));

export default router;
