import { Response } from 'express';
import { withdrawalService } from '../services/withdrawal.service';
import { AuthRequest, AdminAuthRequest, WithdrawalRequestBody } from '../types';

export class WithdrawalController {
  // Create withdrawal request
  async createRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { amount, bank_name, account_number, account_holder }: WithdrawalRequestBody = req.body;

      if (!amount || !bank_name || !account_number || !account_holder) {
        return res.status(400).json({
          success: false,
          error: '금액, 은행명, 계좌번호, 예금주는 필수입니다.'
        });
      }

      const withdrawal = await withdrawalService.createRequest(userId, {
        amount,
        bank_name,
        account_number,
        account_holder
      });

      res.status(201).json({
        success: true,
        data: withdrawal,
        message: `P포인트 ${amount.toLocaleString()}원 출금이 신청되었습니다. 다음 영업일에 지급될 예정입니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get user's withdrawal history
  async getUserWithdrawals(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { page, limit } = req.query;

      const result = await withdrawalService.getUserWithdrawals(userId, {
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

  // Admin: Get all withdrawals
  async getAllWithdrawals(req: AdminAuthRequest, res: Response) {
    try {
      const { status, page, limit } = req.query;

      const result = await withdrawalService.getAllWithdrawals({
        status: status as 'pending' | 'approved' | 'rejected' | 'completed' | undefined,
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

  // Admin: Approve withdrawal
  async approveWithdrawal(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { admin_note } = req.body;

      const withdrawal = await withdrawalService.approveWithdrawal(id, admin_note);

      res.json({
        success: true,
        data: withdrawal,
        message: '출금이 승인되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Reject withdrawal
  async rejectWithdrawal(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { admin_note } = req.body;

      const withdrawal = await withdrawalService.rejectWithdrawal(id, admin_note);

      res.json({
        success: true,
        data: withdrawal,
        message: '출금이 거절되었습니다. 포인트가 환불되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Complete withdrawal
  async completeWithdrawal(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const withdrawal = await withdrawalService.completeWithdrawal(id);

      res.json({
        success: true,
        data: withdrawal,
        message: '출금이 완료 처리되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const withdrawalController = new WithdrawalController();
