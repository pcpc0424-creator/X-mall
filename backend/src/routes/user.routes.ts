import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Protected routes
router.get('/profile', authenticateUser, (req, res) => userController.getProfile(req, res));

// Genealogy (dealer only) - view my downline
router.get('/genealogy', authenticateUser, (req, res) => userController.getMyGenealogy(req, res));

// Change password
router.put('/password', authenticateUser, (req, res) => userController.changePassword(req, res));

export default router;
