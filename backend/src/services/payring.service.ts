import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';

interface PayringConfig {
  apiKey: string;
  apiUrl: string;
  callbackUrl: string;
}

interface CardPaymentRequest {
  orderId: string;
  productName: string;
  amount: number;
  cardNumber: string;      // 카드번호 (숫자만)
  cardExpiry: string;      // 유효기간 (YYYYMM)
  cardAuth: string;        // 생년월일 6자리 또는 사업자등록번호 10자리
  cardPwd: string;         // 비밀번호 앞 2자리
  quota: string;           // 할부개월 (00=일시불, 03=3개월 등)
  taxCode?: string;        // 과세:00, 비과세:01
  customerName: string;
  customerEmail?: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;  // 페이링 거래번호 (tranid)
  orderId?: string;
  amount?: number;
  message?: string;
  resCode?: string;
  error?: string;
}

interface PayringOrderResponse {
  rescode: string;
  resmsg: string;
  tranid?: string;
}

export class PayringService {
  private config: PayringConfig;

  constructor() {
    this.config = {
      apiKey: process.env.PAYRING_API_KEY || '',
      apiUrl: process.env.PAYRING_API_URL || 'http://api.payring.co.kr',
      callbackUrl: process.env.PAYRING_CALLBACK_URL || '',
    };
  }

  // 수기결제 요청
  async processCardPayment(data: CardPaymentRequest): Promise<PaymentResult> {
    const transactionId = generateUUID();

    try {
      // 결제 요청 정보를 DB에 먼저 저장 (pending 상태)
      await query(
        `INSERT INTO payment_requests (id, order_id, amount, status, payment_data, created_at)
         VALUES ($1, $2, $3, 'pending', $4, NOW())`,
        [
          transactionId,
          data.orderId,
          data.amount,
          JSON.stringify({
            productName: data.productName,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            quota: data.quota,
          }),
        ]
      );

      // 페이링 수기결제 API 호출
      const formData = new URLSearchParams();
      formData.append('apikey', this.config.apiKey);
      formData.append('orderid', data.orderId);
      formData.append('prodname', data.productName);
      formData.append('amount', data.amount.toString());
      formData.append('encinfo', data.cardNumber);
      formData.append('encdata', data.cardExpiry);
      formData.append('cardauth', data.cardAuth);
      formData.append('cardpwd', data.cardPwd);
      formData.append('quota', data.quota);
      formData.append('taxcode', data.taxCode || '00');
      formData.append('custname', data.customerName);
      formData.append('custemail', data.customerEmail || '');
      formData.append('info1', transactionId); // 내부 트랜잭션 ID 저장

      const response = await fetch(`${this.config.apiUrl}/v1/sugi/order.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const result = (await response.json()) as PayringOrderResponse;

      if (result.rescode === '0000') {
        // 결제 성공
        await this.updatePaymentStatus(transactionId, 'completed', result.tranid);

        return {
          success: true,
          transactionId: result.tranid,
          orderId: data.orderId,
          amount: data.amount,
          message: result.resmsg || '결제가 완료되었습니다.',
          resCode: result.rescode,
        };
      } else {
        // 결제 실패
        await this.updatePaymentStatus(transactionId, 'failed', undefined, result.resmsg);

        return {
          success: false,
          resCode: result.rescode,
          error: this.getErrorMessage(result.rescode, result.resmsg),
        };
      }
    } catch (error: any) {
      console.error('Payring payment error:', error);
      await this.updatePaymentStatus(transactionId, 'failed', undefined, error.message);

      return {
        success: false,
        error: '결제 처리 중 오류가 발생했습니다.',
      };
    }
  }

  // 결제 취소
  async cancelPayment(orderId: string, amount: number): Promise<PaymentResult> {
    try {
      // DB에서 결제 정보 조회
      const paymentResult = await query(
        `SELECT * FROM payment_requests WHERE order_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      if (paymentResult.rows.length === 0) {
        return { success: false, error: '취소할 결제 정보를 찾을 수 없습니다.' };
      }

      const payment = paymentResult.rows[0];

      // 페이링 취소 API 호출
      const formData = new URLSearchParams();
      formData.append('apikey', this.config.apiKey);
      formData.append('orderid', orderId);
      formData.append('amount', amount.toString());

      const response = await fetch(`${this.config.apiUrl}/v1/sugi/cancel.do`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const result = (await response.json()) as PayringOrderResponse;

      if (result.rescode === '0000') {
        await this.updatePaymentStatus(payment.id, 'cancelled');

        return {
          success: true,
          transactionId: payment.payring_transaction_id,
          orderId: orderId,
          message: '결제가 취소되었습니다.',
        };
      } else {
        return {
          success: false,
          resCode: result.rescode,
          error: this.getErrorMessage(result.rescode, result.resmsg),
        };
      }
    } catch (error: any) {
      console.error('Payring cancel error:', error);
      return { success: false, error: error.message };
    }
  }

  // 결제 결과 콜백 처리 (페이링에서 호출)
  async handleCallback(data: {
    orderid: string;
    tranid: string;
    name?: string;
    mobile?: string;
    email?: string;
    item_name?: string;
    item_amt?: string;
    card_num?: string;
    card_auth_no?: string;
    card_name?: string;
    tran_date?: string;
    rescode: string;
    resmsg: string;
  }): Promise<{ rescode: string; resmsg: string }> {
    try {
      if (data.rescode === '0000') {
        // 결제 성공 콜백
        await query(
          `UPDATE payment_requests
           SET status = 'completed',
               payring_transaction_id = $1,
               payment_data = payment_data || $2::jsonb,
               updated_at = NOW()
           WHERE order_id = $3`,
          [
            data.tranid,
            JSON.stringify({
              cardNum: data.card_num,
              cardAuthNo: data.card_auth_no,
              cardName: data.card_name,
              tranDate: data.tran_date,
            }),
            data.orderid,
          ]
        );
      } else {
        // 결제 실패 콜백
        await query(
          `UPDATE payment_requests
           SET status = 'failed',
               error_message = $1,
               updated_at = NOW()
           WHERE order_id = $2`,
          [data.resmsg, data.orderid]
        );
      }

      return { rescode: '0000', resmsg: 'SUCCESS' };
    } catch (error) {
      console.error('Callback processing error:', error);
      return { rescode: '1000', resmsg: '재전송 요청' };
    }
  }

  // 결제 상태 업데이트
  async updatePaymentStatus(
    transactionId: string,
    status: string,
    payringTransactionId?: string,
    errorMessage?: string
  ): Promise<void> {
    await query(
      `UPDATE payment_requests
       SET status = $1,
           payring_transaction_id = COALESCE($2, payring_transaction_id),
           error_message = COALESCE($3, error_message),
           updated_at = NOW()
       WHERE id = $4`,
      [status, payringTransactionId || null, errorMessage || null, transactionId]
    );
  }

  // 결제 조회
  async getPayment(transactionId: string): Promise<any> {
    const result = await query(
      `SELECT * FROM payment_requests WHERE id = $1`,
      [transactionId]
    );
    return result.rows[0] || null;
  }

  // 주문별 결제 조회
  async getPaymentByOrderId(orderId: string): Promise<any> {
    const result = await query(
      `SELECT * FROM payment_requests WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orderId]
    );
    return result.rows[0] || null;
  }

  // 관리자용 결제 목록 조회
  async getPaymentList(options: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }): Promise<{ payments: any[]; pagination: any }> {
    const { page, limit, status, search } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND pr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (pr.order_id ILIKE $${paramIndex} OR o.order_number ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) FROM payment_requests pr
       LEFT JOIN orders o ON pr.order_id = o.id::text OR pr.order_id = o.order_number
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 결제 목록 조회
    const listParams = [...params, limit, offset];
    const listResult = await query(
      `SELECT pr.*, o.order_number, o.total_krw as order_total, u.name as user_name, u.username
       FROM payment_requests pr
       LEFT JOIN orders o ON pr.order_id = o.id::text OR pr.order_id = o.order_number
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY pr.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      listParams
    );

    return {
      payments: listResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 관리자용 결제 상세 조회
  async getPaymentDetail(id: string): Promise<any> {
    const result = await query(
      `SELECT pr.*, o.order_number, o.total_krw as order_total, o.status as order_status,
              o.shipping_name, o.shipping_phone, o.shipping_address,
              u.name as user_name, u.username, u.phone as user_phone
       FROM payment_requests pr
       LEFT JOIN orders o ON pr.order_id = o.id::text OR pr.order_id = o.order_number
       LEFT JOIN users u ON o.user_id = u.id
       WHERE pr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // 에러 메시지 변환
  private getErrorMessage(rescode: string, resmsg: string): string {
    const errorMessages: Record<string, string> = {
      P001: '가입자 정보가 없습니다.',
      P002: '주문 정보가 없습니다.',
      P003: '주문번호가 중복됩니다.',
      P004: '결제 요청 정보가 없습니다.',
      P006: '결제 대기시간이 초과되었습니다.',
      P007: '결제 대기 중이 아닙니다.',
      P008: '결제에 실패했습니다.',
      P009: '결제 취소 대상이 아닙니다.',
      P010: '이미 취소된 거래입니다.',
      P201: '입력 횟수 3회 초과',
      P202: '결제금액이 일치하지 않습니다.',
      P203: '간편결제 비밀번호 오류',
      P301: '주문이 취소되었습니다.',
      P900: '전문 오류가 발생했습니다.',
      P901: 'DB 처리 실패',
      P902: 'PG사 통신 실패',
      P903: 'PG사 처리 실패',
      P999: '기타 오류가 발생했습니다.',
    };

    return errorMessages[rescode] || resmsg || '결제 처리 중 오류가 발생했습니다.';
  }
}

export const payringService = new PayringService();
