import { Response } from 'express';
import { pointService } from '../services/point.service';
import { userService } from '../services/user.service';
import { query } from '../config/database';
import { AuthRequest, AdminAuthRequest, AdminGrantPointsBody } from '../types';
import { parsePointsExcel } from '../utils/excel';

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
        pointType: point_type as 'X' | undefined,
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

  // Transfer points removed - P/C/T no longer supported

  // Admin: Grant points
  async adminGrantPoints(req: AdminAuthRequest, res: Response) {
    try {
      const adminId = req.admin!.id;
      const { username, user_id, point_type, amount, reason } = req.body;

      if ((!username && !user_id) || !point_type || !amount) {
        return res.status(400).json({
          success: false,
          error: '사용자 아이디/ID, 포인트 종류, 금액은 필수입니다.'
        });
      }

      // X포인트만 지원
      if (point_type !== 'X') {
        return res.status(400).json({
          success: false,
          error: 'X포인트만 지급할 수 있습니다.'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '지급 금액은 0보다 커야 합니다.'
        });
      }

      // Find user by username or id
      let user;
      if (username) {
        user = await userService.findByUsername(username);
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

  // Admin: Deduct points
  async adminDeductPoints(req: AdminAuthRequest, res: Response) {
    try {
      const adminId = req.admin!.id;
      const { username, user_id, point_type, amount, reason } = req.body;

      if ((!username && !user_id) || !point_type || !amount) {
        return res.status(400).json({
          success: false,
          error: '사용자 아이디/ID, 포인트 종류, 금액은 필수입니다.'
        });
      }

      // X포인트만 지원
      if (point_type !== 'X') {
        return res.status(400).json({
          success: false,
          error: 'X포인트만 차감할 수 있습니다.'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '차감 금액은 0보다 커야 합니다.'
        });
      }

      // Find user by username or id
      let user;
      if (username) {
        user = await userService.findByUsername(username);
      } else {
        user = await userService.findById(user_id);
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '사용자를 찾을 수 없습니다.'
        });
      }

      const newBalance = await pointService.adminDeductPoints(adminId, user.id, point_type, amount, reason);

      res.json({
        success: true,
        data: {
          user_id: user.id,
          point_type,
          deducted: amount,
          new_balance: newBalance
        },
        message: `${user.name}님의 ${point_type}포인트 ${amount.toLocaleString()}원이 차감되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get pending X-points (대기 중 X포인트)
  async getPendingXPoints(req: AdminAuthRequest, res: Response) {
    try {
      const result = await query(
        `SELECT px.id, px.user_id, px.order_id, px.xpoint_amount, px.pv_amount,
                px.scheduled_release_date, px.status, px.created_at,
                u.name as user_name, u.username as user_username, o.order_number
         FROM pending_xpoints px
         JOIN users u ON px.user_id = u.id
         LEFT JOIN orders o ON px.order_id = o.id
         WHERE px.status = 'pending'
         ORDER BY px.scheduled_release_date ASC`
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
      const { point_type, transaction_type, username, page = '1', limit = '20' } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const conditions: string[] = [];
      const params: any[] = [];

      if (point_type) {
        params.push(point_type);
        conditions.push(`pt.point_type = $${params.length}`);
      }

      if (transaction_type) {
        params.push(transaction_type);
        conditions.push(`pt.transaction_type = $${params.length}`);
      }

      if (username) {
        params.push(`%${username}%`);
        conditions.push(`(u.username ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await query(
        `SELECT COUNT(*) FROM point_transactions pt
         LEFT JOIN users u ON pt.user_id = u.id
         ${whereClause}`,
        params
      );

      params.push(parseInt(limit as string), offset);
      const result = await query(
        `SELECT pt.*, u.name as user_name, u.username as user_username
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
          total: parseInt(countResult.rows[0].count),
          page: parseInt(page as string),
          limit: parseInt(limit as string)
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Bulk grant points
  async bulkGrant(req: AdminAuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일을 업로드해주세요.'
        });
      }

      const adminId = req.admin!.id;

      // Parse Excel file
      const parseResult = parsePointsExcel(req.file.buffer);

      if (parseResult.data.length === 0 && parseResult.errors.length === 0) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일에 데이터가 없습니다.'
        });
      }

      // Combine parse errors
      const allErrors = parseResult.errors.map(e => ({
        row: e.row,
        username: '',
        error: e.message
      }));

      // Bulk grant points
      const bulkResult = await pointService.bulkGrantPoints(adminId, parseResult.data);

      // Merge errors
      const finalErrors = [...allErrors, ...bulkResult.errors];

      res.json({
        success: true,
        data: {
          total: parseResult.data.length + parseResult.errors.length,
          success_count: bulkResult.success_count,
          fail_count: parseResult.errors.length + bulkResult.fail_count,
          errors: finalErrors.slice(0, 100) // Limit error list
        },
        message: `총 ${bulkResult.success_count}건의 포인트가 지급되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || '파일 처리 중 오류가 발생했습니다.'
      });
    }
  }
}

export const pointController = new PointController();
