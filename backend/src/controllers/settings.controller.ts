import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { cacheSet, cacheGet } from '../config/redis';

class SettingsController {
  // Dashboard stats
  async getDashboardStats(req: Request, res: Response) {
    try {
      // Total revenue
      const revenueResult = await query(
        `SELECT COALESCE(SUM(total_krw), 0) as total FROM orders WHERE status NOT IN ('cancelled', 'refunded')`
      );

      // Total orders
      const ordersResult = await query(`SELECT COUNT(*) FROM orders`);

      // Total members
      const membersResult = await query(`SELECT COUNT(*) FROM users WHERE is_active = true`);

      // Dealer/Consumer count
      const gradeResult = await query(
        `SELECT grade, COUNT(*) as count FROM users WHERE is_active = true GROUP BY grade`
      );

      // Pending withdrawals
      const withdrawalsResult = await query(
        `SELECT COUNT(*) FROM point_withdrawals WHERE status = 'pending'`
      );

      const dealerCount = gradeResult.rows.find((r: any) => r.grade === 'dealer')?.count || 0;
      const consumerCount = gradeResult.rows.find((r: any) => r.grade === 'consumer')?.count || 0;

      res.json({
        success: true,
        data: {
          totalRevenue: parseFloat(revenueResult.rows[0].total),
          totalOrders: parseInt(ordersResult.rows[0].count),
          totalMembers: parseInt(membersResult.rows[0].count),
          dealerCount: parseInt(dealerCount),
          consumerCount: parseInt(consumerCount),
          pendingWithdrawals: parseInt(withdrawalsResult.rows[0].count)
        }
      });
    } catch (error: any) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get current exchange rate
  async getCurrentExchangeRate(req: Request, res: Response) {
    try {
      // Try cache first
      const cached = await cacheGet('exchange_rate:current');
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }

      const result = await query(
        `SELECT * FROM exchange_rates ORDER BY effective_date DESC, created_at DESC LIMIT 1`
      );

      if (result.rows.length === 0) {
        // Default rate
        return res.json({
          success: true,
          data: { rate: 1350, rate_type: 'weekly', effective_date: new Date().toISOString().split('T')[0] }
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Get exchange rate error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Set exchange rate
  async setExchangeRate(req: Request, res: Response) {
    try {
      const { rate, rate_type = 'weekly' } = req.body;

      if (!rate || rate < 100 || rate > 10000) {
        return res.status(400).json({ success: false, message: '유효한 환율을 입력해주세요 (100~10000)' });
      }

      const today = new Date().toISOString().split('T')[0];

      const result = await query(
        `INSERT INTO exchange_rates (id, rate, rate_type, effective_date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [generateUUID(), rate, rate_type, today]
      );

      // Update cache
      await cacheSet('exchange_rate:current', JSON.stringify({
        rate,
        rate_type,
        effective_date: today,
        updated_at: new Date().toISOString()
      }), 86400);

      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Set exchange rate error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get exchange rate history
  async getExchangeRateHistory(req: Request, res: Response) {
    try {
      const result = await query(
        `SELECT * FROM exchange_rates ORDER BY effective_date DESC, created_at DESC LIMIT 50`
      );

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('Get exchange rate history error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Get holidays
  async getHolidays(req: Request, res: Response) {
    try {
      const result = await query(
        `SELECT * FROM holidays WHERE holiday_date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY holiday_date ASC`
      );

      res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error('Get holidays error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Add holiday
  async addHoliday(req: Request, res: Response) {
    try {
      const { date, description } = req.body;

      if (!date) {
        return res.status(400).json({ success: false, message: '날짜를 입력해주세요' });
      }

      const result = await query(
        `INSERT INTO holidays (id, holiday_date, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (holiday_date) DO UPDATE SET description = $3
         RETURNING *`,
        [generateUUID(), date, description || '']
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Add holiday error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Delete holiday
  async deleteHoliday(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await query(`DELETE FROM holidays WHERE id = $1`, [id]);

      res.json({ success: true, message: '공휴일이 삭제되었습니다' });
    } catch (error: any) {
      console.error('Delete holiday error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const settingsController = new SettingsController();
