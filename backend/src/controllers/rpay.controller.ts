import { Response } from 'express';
import { rpayService } from '../services/rpay.service';
import { userService } from '../services/user.service';
import { AuthRequest, AdminAuthRequest, AdminRpayDepositBody } from '../types';

export class RpayController {
  // Get R-pay balance
  async getBalance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const balance = await rpayService.getBalance(userId);

      res.json({
        success: true,
        data: {
          balance_krw: balance
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get R-pay transaction history
  async getHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { page, limit } = req.query;

      const result = await rpayService.getTransactionHistory(userId, {
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

  // Admin: Deposit R-pay
  async adminDeposit(req: AdminAuthRequest, res: Response) {
    try {
      const adminId = req.admin!.id;
      const { username, user_id, amount, reason } = req.body;

      if ((!username && !user_id) || !amount) {
        return res.status(400).json({
          success: false,
          error: '사용자 아이디/ID와 금액은 필수입니다.'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '충전 금액은 0보다 커야 합니다.'
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

      const newBalance = await rpayService.adminDeposit(adminId, user.id, amount, reason);

      res.json({
        success: true,
        data: {
          user_id: user.id,
          deposited: amount,
          new_balance: newBalance
        },
        message: `${user.name}님에게 X페이 ${amount.toLocaleString()}원이 충전되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const rpayController = new RpayController();
