import { Response } from 'express';
import { rpayService } from '../services/rpay.service';
import { userService } from '../services/user.service';
import { payringService } from '../services/payring.service';
import { AuthRequest, AdminAuthRequest, AdminRpayDepositBody } from '../types';
import { parseRpayExcel } from '../utils/excel';

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

  // User: Charge R-pay by card
  async chargeByCard(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userName = req.user!.username;
      const {
        amount,
        card_number,
        card_expiry,
        card_auth,
        card_pwd,
        quota
      } = req.body;

      // 금액 검증
      if (!amount || amount < 1000) {
        return res.status(400).json({
          success: false,
          error: '최소 충전 금액은 1,000원입니다.'
        });
      }

      if (amount > 10000000) {
        return res.status(400).json({
          success: false,
          error: '최대 충전 금액은 10,000,000원입니다.'
        });
      }

      // 카드 정보 검증
      if (!card_number || !card_expiry || !card_auth || !card_pwd) {
        return res.status(400).json({
          success: false,
          error: '카드 정보를 모두 입력해주세요.'
        });
      }

      // 카드번호 검증
      const cardNumClean = card_number.replace(/\D/g, '');
      if (cardNumClean.length < 13 || cardNumClean.length > 16) {
        return res.status(400).json({
          success: false,
          error: '카드번호가 올바르지 않습니다.'
        });
      }

      // 유효기간 변환 (MMYY -> YYYYMM)
      let expiryFormatted = card_expiry.replace(/\D/g, '');
      if (expiryFormatted.length === 4) {
        const mm = expiryFormatted.substring(0, 2);
        const yy = expiryFormatted.substring(2, 4);
        expiryFormatted = `20${yy}${mm}`;
      }

      // 주문번호 생성
      const orderId = `XPAY${Date.now()}`;

      // 페이링 카드 결제 진행
      const paymentResult = await payringService.processCardPayment({
        orderId,
        productName: 'X페이 충전',
        amount: parseInt(amount),
        cardNumber: cardNumClean,
        cardExpiry: expiryFormatted,
        cardAuth: card_auth.replace(/\D/g, ''),
        cardPwd: card_pwd.substring(0, 2),
        quota: quota || '00',
        taxCode: '00',
        customerName: userName,
        customerEmail: ''
      });

      if (!paymentResult.success) {
        return res.status(400).json({
          success: false,
          error: paymentResult.error || '카드 결제에 실패했습니다.'
        });
      }

      // 결제 성공 -> X페이 충전
      const newBalance = await rpayService.deposit(
        userId,
        parseInt(amount),
        `카드 충전 (${orderId})`
      );

      res.json({
        success: true,
        data: {
          charged_amount: amount,
          new_balance: newBalance,
          transaction_id: paymentResult.transactionId
        },
        message: `X페이 ${parseInt(amount).toLocaleString()}원이 충전되었습니다.`
      });
    } catch (error: any) {
      console.error('Charge by card error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '충전 처리 중 오류가 발생했습니다.'
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

  // Admin: Deduct R-pay
  async adminDeduct(req: AdminAuthRequest, res: Response) {
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

      const newBalance = await rpayService.adminDeduct(adminId, user.id, amount, reason);

      res.json({
        success: true,
        data: {
          user_id: user.id,
          deducted: amount,
          new_balance: newBalance
        },
        message: `${user.name}님의 X페이 ${amount.toLocaleString()}원이 차감되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Bulk deposit R-pay
  async bulkDeposit(req: AdminAuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일을 업로드해주세요.'
        });
      }

      const adminId = req.admin!.id;

      // Parse Excel file
      const parseResult = parseRpayExcel(req.file.buffer);

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

      // Bulk deposit
      const bulkResult = await rpayService.bulkDeposit(adminId, parseResult.data);

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
        message: `총 ${bulkResult.success_count}건의 X페이가 충전되었습니다.`
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || '파일 처리 중 오류가 발생했습니다.'
      });
    }
  }
}

export const rpayController = new RpayController();
