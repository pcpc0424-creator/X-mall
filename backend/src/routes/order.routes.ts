import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticateUser, dealerOnly } from '../middleware/auth';

const router = Router();

// Protected routes (dealer only for creating orders)
router.post('/', authenticateUser, dealerOnly, (req, res) => orderController.createOrder(req, res));
router.get('/', authenticateUser, (req, res) => orderController.getUserOrders(req, res));
router.get('/:id', authenticateUser, (req, res) => orderController.getOrderById(req, res));

export default router;
