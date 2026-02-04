import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import rpayRoutes from './rpay.routes';
import pointRoutes from './point.routes';
import withdrawalRoutes from './withdrawal.routes';
import payringRoutes from './payring.routes';
import orderRoutes from './order.routes';
import productRoutes from './product.routes';
import contentRoutes from './content.routes';
import adminRoutes from './admin.routes';
import { query } from '../config/database';
import { memoryCache } from '../utils/cache';

const router = Router();

// Public/User routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rpay', rpayRoutes);
router.use('/points', pointRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/payring', payringRoutes);
router.use('/orders', orderRoutes);
router.use('/products', productRoutes);
router.use('/content', contentRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public exchange rate endpoint (for checkout page) - 5분 캐싱 적용
router.get('/exchange-rate', async (req, res) => {
  const cacheKey = 'exchange_rate';

  try {
    // 캐시 확인
    const cached = memoryCache.get<{ rate: number; effective_date: string | null }>(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const result = await query(
      `SELECT rate, effective_date FROM exchange_rates WHERE rate_type = 'weekly' ORDER BY effective_date DESC LIMIT 1`
    );

    const data = result.rows[0]
      ? { rate: parseFloat(result.rows[0].rate), effective_date: result.rows[0].effective_date }
      : { rate: 1400, effective_date: null };

    // 5분간 캐싱
    memoryCache.set(cacheKey, data, 5 * 60 * 1000);

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
