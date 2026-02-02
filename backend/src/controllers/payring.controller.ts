import { Request, Response } from 'express';
import { payringService } from '../services/payring.service';
import { AuthRequest } from '../types';

export class PayringController {
  // 수기결제 처리 (카드 정보로 직접 결제)
  async processPayment(req: AuthRequest, res: Response) {
    try {
      const {
        order_id,
        product_name,
        amount,
        card_number,
        card_expiry,
        card_auth,
        card_pwd,
        quota,
        tax_code,
        customer_name,
        customer_email,
      } = req.body;

      // 필수 필드 검증
      if (!order_id || !product_name || !amount || !card_number || !card_expiry || !card_auth || !card_pwd || !customer_name) {
        return res.status(400).json({
          success: false,
          error: '필수 정보가 누락되었습니다.',
        });
      }

      // 카드번호 검증 (숫자만, 13-16자리)
      const cardNumClean = card_number.replace(/\D/g, '');
      if (cardNumClean.length < 13 || cardNumClean.length > 16) {
        return res.status(400).json({
          success: false,
          error: '카드번호가 올바르지 않습니다.',
        });
      }

      // 유효기간 검증 (YYYYMM 또는 MMYY 형식)
      let expiryFormatted = card_expiry.replace(/\D/g, '');
      if (expiryFormatted.length === 4) {
        // MMYY -> YYYYMM 변환
        const mm = expiryFormatted.substring(0, 2);
        const yy = expiryFormatted.substring(2, 4);
        expiryFormatted = `20${yy}${mm}`;
      }
      if (expiryFormatted.length !== 6) {
        return res.status(400).json({
          success: false,
          error: '유효기간이 올바르지 않습니다.',
        });
      }

      // 결제 금액 검증
      const paymentAmount = parseInt(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: '결제 금액이 올바르지 않습니다.',
        });
      }

      const result = await payringService.processCardPayment({
        orderId: order_id,
        productName: product_name,
        amount: paymentAmount,
        cardNumber: cardNumClean,
        cardExpiry: expiryFormatted,
        cardAuth: card_auth.replace(/\D/g, ''),
        cardPwd: card_pwd.substring(0, 2),
        quota: quota || '00',
        taxCode: tax_code || '00',
        customerName: customer_name,
        customerEmail: customer_email,
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            transactionId: result.transactionId,
            orderId: result.orderId,
            amount: result.amount,
          },
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          resCode: result.resCode,
        });
      }
    } catch (error: any) {
      console.error('Process payment error:', error);
      res.status(500).json({
        success: false,
        error: '결제 처리 중 오류가 발생했습니다.',
      });
    }
  }

  // 결제 결과 콜백 (페이링에서 호출)
  async paymentCallback(req: Request, res: Response) {
    try {
      console.log('Payment callback received:', req.body);

      const result = await payringService.handleCallback(req.body);

      res.json(result);
    } catch (error: any) {
      console.error('Payment callback error:', error);
      res.json({ rescode: '1000', resmsg: '재전송 요청' });
    }
  }

  // 결제 취소
  async cancelPayment(req: AuthRequest, res: Response) {
    try {
      const { order_id } = req.params;
      const { amount } = req.body;

      if (!order_id || !amount) {
        return res.status(400).json({
          success: false,
          error: '주문번호와 취소금액이 필요합니다.',
        });
      }

      const result = await payringService.cancelPayment(order_id, parseInt(amount));

      if (result.success) {
        res.json({
          success: true,
          data: {
            transactionId: result.transactionId,
            orderId: result.orderId,
          },
          message: result.message,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          resCode: result.resCode,
        });
      }
    } catch (error: any) {
      console.error('Cancel payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // 결제 상태 조회
  async getPaymentStatus(req: AuthRequest, res: Response) {
    try {
      const { order_id } = req.params;

      const payment = await payringService.getPaymentByOrderId(order_id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: '결제 정보를 찾을 수 없습니다.',
        });
      }

      res.json({
        success: true,
        data: {
          id: payment.id,
          order_id: payment.order_id,
          amount: parseFloat(payment.amount),
          status: payment.status,
          payring_transaction_id: payment.payring_transaction_id,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
        },
      });
    } catch (error: any) {
      console.error('Get payment status error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // 관리자용 결제 목록 조회
  async getPaymentList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const result = await payringService.getPaymentList({ page, limit, status, search });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get payment list error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // 관리자용 결제 상세 조회
  async getPaymentDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payment = await payringService.getPaymentDetail(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: '결제 정보를 찾을 수 없습니다.',
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      console.error('Get payment detail error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // 관리자용 결제 취소
  async adminCancelPayment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // 결제 정보 조회
      const payment = await payringService.getPaymentDetail(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: '결제 정보를 찾을 수 없습니다.',
        });
      }

      if (payment.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: '이미 취소된 결제입니다.',
        });
      }

      const result = await payringService.cancelPayment(payment.order_id, parseFloat(payment.amount));

      if (result.success) {
        res.json({
          success: true,
          message: '결제가 취소되었습니다.',
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      console.error('Admin cancel payment error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const payringController = new PayringController();
