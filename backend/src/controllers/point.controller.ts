import { Response } from 'express';
import { pointService } from '../services/point.service';
import { userService } from '../services/user.service';
import { query } from '../config/database';
import { AuthRequest, AdminAuthRequest, PointTransferBody, AdminGrantPointsBody } from '../types';

export class PointController {
  // Get point summary
  async getSummary(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const balances = await pointService.getBalances(userId);

      res.json({
        success: true,
        data: balances
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get transaction history
  async getHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { point_type, page, limit } = req.query;

      const result = await pointService.getTransactionHistory(userId, {
        pointType: point_type as 'P' | 'C' | 'T' | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Transfer points (P/C -> T)
  async transfer(req: AuthRequest, res: Response) {
    try {
      const fromUserId = req.user!.id;
      const { to_user_email, point_type, amount }: PointTransferBody = req.body;

      if (!to_user_email || !point_type || !amount) {
        return res.status(400).json({
          success: false,
          error: '수신자 이메일, 포인트 종류, 금액은 필수입니다.'
        });
      }

      if (!['P', 'C'].includes(point_type)) {
        return res.status(400).json({
          success: false,
          error: 'P포인트 또는 C포인트만 이체할 수 있습니다.'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '이체 금액은 0보다 커야 합니다.'
        });
      }

      // Find recipient
      const toUser = await userService.findByEmail(to_user_email);

      if (!toUser) {
        return res.status(404).json({
          success: false,
          error: '수신자를 찾을 수 없습니다.'
        });
      }

      if (toUser.id === fromUserId) {
        return res.status(400).json({
          success: false,
          error: '자신에게 이체할 수 없습니다.'
        });
      }

      await pointService.transferPoints(fromUserId, toUser.id, point_type, amount);

      // Get updated balances
      const balances = await pointService.getBalances(fromUserId);

      res.json({
        success: true,
        data: {
          balances,
          transferred: {
            to: to_user_email,
            from_type: point_type,
            to_type: 'T',
            amount
          }
        },
        message: `${amount.toLocaleString()}원이 ${to_user_email}님에게 T포인트로 이체되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Grant points
  async adminGrantPoints(req: AdminAuthRequest, res: Response) {
    try {
      const adminId = req.admin!.id;
      const { email, user_id, point_type, amount, reason } = req.body;

      if ((!email && !user_id) || !point_type || !amount) {
        return res.status(400).json({
          success: false,
          error: '사용자 이메일/ID, 포인트 종류, 금액은 필수입니다.'
        });
      }

      if (!['P', 'C', 'T'].includes(point_type)) {
        return res.status(400).json({
          success: false,
          error: '유효한 포인트 종류를 입력해주세요. (P, C, T)'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '지급 금액은 0보다 커야 합니다.'
        });
      }

      // Find user by email or id
      let user;
      if (email) {
        user = await userService.findByEmail(email);
      } else {
        user = await userService.findById(user_id);
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      const newBalance = await pointService.adminGrantPoints(adminId, user.id, point_type, amount, reason);

      res.json({
        success: true,
        data: {
          user_id: user.id,
          point_type,
          granted: amount,
          new_balance: newBalance
        },
        message: `${user.name}님에게 ${point_type}포인트 ${amount.toLocaleString()}원이 지급되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get pending P-points
  async getPendingPPoints(req: AdminAuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT pp.*, u.name as user_name, u.email as user_email, o.order_number
         FROM pending_ppoints pp
         JOIN users u ON pp.user_id = u.id
         LEFT JOIN orders o ON pp.order_id = o.id
         WHERE pp.status = 'pending'
         ORDER BY pp.scheduled_release_date ASC`
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get all transactions
  async getAllTransactions(req: AdminAuthRequest, res: Response) {
    try {
      const { point_type, page = '1', limit = '50' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let whereClause = '';
      const params: any[] = [];

      if (point_type) {
        params.push(point_type);
        whereClause = `WHERE pt.point_type = $${params.length}`;
      }

      const countResult = await query(
        `SELECT COUNT(*) FROM point_transactions pt ${whereClause}`,
        params
      );

      params.push(parseInt(limit as string), offset);
      const result = await query(
        `SELECT pt.*, u.name as user_name, u.email as user_email
         FROM point_transactions pt
         LEFT JOIN users u ON pt.user_id = u.id
         ${whereClause}
         ORDER BY pt.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      res.json({
        success: true,
        data: {
          transactions: result.rows,
          total: parseInt(countResult.rows[0].count)
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const pointController = new PointController();
