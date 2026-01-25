import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

// User auth
router.post('/signup', (req, res) => authController.signup(req, res));
router.post('/login', (req, res) => authController.login(req, res));

export default router;
