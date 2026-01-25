import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import pointRoutes from './point.routes';
import rpayRoutes from './rpay.routes';
import withdrawalRoutes from './withdrawal.routes';
import orderRoutes from './order.routes';
import productRoutes from './product.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Public/User routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/points', pointRoutes);
router.use('/rpay', rpayRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/orders', orderRoutes);
router.use('/products', productRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
