import { query, getClient } from '../config/database';
import { generateUUID, generateOrderNumber } from '../utils/helpers';
import { getPPointReleaseDate } from '../utils/business-day';
import { rpayService } from './rpay.service';
import { pointService } from './point.service';
import { payringService } from './payring.service';
import { Order, OrderStatus, CreateOrderBody, Product } from '../types';

export class OrderService {
  async createOrder(
    userId: string,
    userGrade: 'dealer' | 'consumer',
    data: CreateOrderBody
  ): Promise<Order> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get product details and calculate totals
      let totalKrw = 0;
      let totalPv = 0;
      const orderItems: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        unit_pv: number;
        total_price: number;
        total_pv: number;
      }> = [];

      for (const item of data.items) {
        const productResult = await client.query(
          `SELECT * FROM products WHERE id = $1 AND is_active = true FOR UPDATE`,
          [item.product_id]
        );

        if (productResult.rows.length === 0) {
          throw new Error(`상품을 찾을 수 없습니다: ${item.product_id}`);
        }

        const product: Product = productResult.rows[0];

        if (product.stock_quantity < item.quantity) {
          throw new Error(`재고가 부족합니다: ${product.name} (재고: ${product.stock_quantity})`);
        }

        // Use dealer price for dealers, regular price for consumers
        const unitPrice = userGrade === 'dealer'
          ? parseFloat(product.price_dealer_krw.toString())
          : parseFloat(product.price_krw.toString());
        // Only dealers earn PV
        const unitPv = userGrade === 'dealer' ? parseFloat(product.pv_value.toString()) : 0;
        const itemTotal = unitPrice * item.quantity;
        const itemPv = unitPv * item.quantity;

        totalKrw += itemTotal;
        totalPv += itemPv;

        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: unitPrice,
          unit_pv: unitPv,
          total_price: itemTotal,
          total_pv: itemPv
        });

        // Update stock
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
          [item.quantity, product.id]
        );
      }

      // Validate payment amounts
      const payment = data.payment;
      const totalPayment = (payment.rpay || 0) + (payment.ppoint || 0) + (payment.cpoint || 0) +
                          (payment.tpoint || 0) + (payment.card || 0) + (payment.bank || 0);

      if (Math.abs(totalPayment - totalKrw) > 1) {
        throw new Error(`결제 금액이 일치하지 않습니다. (주문금액: ${totalKrw}, 결제금액: ${totalPayment})`);
      }

      // Process payments
      const orderId = generateUUID();

      // R-pay payment
      if (payment.rpay && payment.rpay > 0) {
        const rpayBalance = await client.query(
          `SELECT balance_krw FROM rpay_balance WHERE user_id = $1 FOR UPDATE`,
          [userId]
        );
        if (parseFloat(rpayBalance.rows[0]?.balance_krw || 0) < payment.rpay) {
          throw new Error('X페이 잔액이 부족합니다.');
        }
        await client.query(
          `UPDATE rpay_balance SET balance_krw = balance_krw - $1 WHERE user_id = $2`,
          [payment.rpay, userId]
        );
      }

      // Point payments
      const pointTypes: Array<{ key: 'ppoint' | 'cpoint' | 'tpoint'; type: 'P' | 'C' | 'T' }> = [
        { key: 'ppoint', type: 'P' },
        { key: 'cpoint', type: 'C' },
        { key: 'tpoint', type: 'T' }
      ];

      for (const pt of pointTypes) {
        const amount = payment[pt.key];
        if (amount && amount > 0) {
          const balanceResult = await client.query(
            `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = $2 FOR UPDATE`,
            [userId, pt.type]
          );
          if (parseFloat(balanceResult.rows[0]?.balance || 0) < amount) {
            throw new Error(`${pt.type}포인트 잔액이 부족합니다.`);
          }
          await client.query(
            `UPDATE point_balances SET balance = balance - $1 WHERE user_id = $2 AND point_type = $3`,
            [amount, userId, pt.type]
          );
        }
      }

      // Create order
      const orderNumber = generateOrderNumber();
      const orderResult = await client.query(
        `INSERT INTO orders (id, order_number, user_id, total_pv, total_krw,
         payment_rpay, payment_ppoint, payment_cpoint, payment_tpoint, payment_card, payment_bank,
         shipping_name, shipping_phone, shipping_address, status, payring_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'paid', $15)
         RETURNING *`,
        [orderId, orderNumber, userId, totalPv, totalKrw,
         payment.rpay || 0, payment.ppoint || 0, payment.cpoint || 0, payment.tpoint || 0,
         payment.card || 0, payment.bank || 0,
         data.shipping.name, data.shipping.phone, data.shipping.address,
         payment.payring_order_id || null]
      );

      // Create order items
      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, unit_pv, total_price, total_pv)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [generateUUID(), orderId, item.product_id, item.product_name, item.quantity,
           item.unit_price, item.unit_pv, item.total_price, item.total_pv]
        );
      }

      // Schedule P-point reward (14 days later)
      // Back margin = 50% of PV value
      const ppointReward = totalPv * 0.5;
      const releaseDate = getPPointReleaseDate(new Date());

      await client.query(
        `INSERT INTO pending_ppoints (id, user_id, order_id, ppoint_amount, scheduled_release_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [generateUUID(), userId, orderId, ppointReward, releaseDate]
      );

      await client.query('COMMIT');
      return orderResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserOrders(
    userId: string,
    options: { page?: number; limit?: number; status?: OrderStatus } = {}
  ): Promise<{ orders: any[]; total: number }> {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM orders ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const ordersResult = await query(
      `SELECT * FROM orders ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Get items for each order
    const orders = [];
    for (const order of ordersResult.rows) {
      const itemsResult = await query(
        `SELECT * FROM order_items WHERE order_id = $1`,
        [order.id]
      );
      orders.push({
        ...order,
        items: itemsResult.rows
      });
    }

    return {
      orders,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getAllOrders(
    options: {
      page?: number;
      limit?: number;
      status?: OrderStatus;
      search?: string;
    } = {}
  ): Promise<{ orders: any[]; total: number }> {
    const { page = 1, limit = 20, status, search } = options;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    const conditions: string[] = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(o.order_number ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.username ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM orders o JOIN users u ON o.user_id = u.id ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const ordersResult = await query(
      `SELECT o.*, u.name as user_name, u.username as user_username
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      orders: ordersResult.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getOrderById(orderId: string): Promise<any> {
    const orderResult = await query(
      `SELECT o.*, u.name as user_name, u.username as user_username
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    const itemsResult = await query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    return {
      ...orderResult.rows[0],
      items: itemsResult.rows
    };
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 먼저 현재 주문 정보 조회
      const orderInfo = await client.query(
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
      );

      if (orderInfo.rows.length === 0) {
        throw new Error('주문을 찾을 수 없습니다.');
      }

      const order = orderInfo.rows[0];
      const previousStatus = order.status;

      // 이미 취소/환불된 주문은 다시 처리하지 않음
      if ((previousStatus === 'cancelled' || previousStatus === 'refunded') &&
          (status === 'cancelled' || status === 'refunded')) {
        throw new Error('이미 취소/환불된 주문입니다.');
      }

      const result = await client.query(
        `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
        [status, orderId]
      );

      // If cancelled or refunded, restore stock, refund points, and cancel pending P-points
      if (status === 'cancelled' || status === 'refunded') {
        const userId = order.user_id;

        // 1. Cancel pending P-points
        await client.query(
          `UPDATE pending_ppoints SET status = 'cancelled' WHERE order_id = $1 AND status = 'pending'`,
          [orderId]
        );

        // 2. Restore stock for each order item
        const orderItems = await client.query(
          `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
          [orderId]
        );

        for (const item of orderItems.rows) {
          if (item.product_id) {
            await client.query(
              `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
              [item.quantity, item.product_id]
            );
          }
        }

        // 3. Refund R-pay (X페이)
        const rpayAmount = parseFloat(order.payment_rpay || 0);
        if (rpayAmount > 0) {
          await client.query(
            `UPDATE rpay_balance SET balance_krw = balance_krw + $1 WHERE user_id = $2`,
            [rpayAmount, userId]
          );
          // 환불 트랜잭션 기록
          await client.query(
            `INSERT INTO rpay_transactions (id, user_id, type, amount_krw, description)
             VALUES ($1, $2, 'refund', $3, $4)`,
            [generateUUID(), userId, rpayAmount, `주문 ${status === 'cancelled' ? '취소' : '환불'} - ${order.order_number}`]
          );
        }

        // 4. Refund P/C/T points
        const pointRefunds = [
          { amount: parseFloat(order.payment_ppoint || 0), type: 'P' },
          { amount: parseFloat(order.payment_cpoint || 0), type: 'C' },
          { amount: parseFloat(order.payment_tpoint || 0), type: 'T' }
        ];

        for (const refund of pointRefunds) {
          if (refund.amount > 0) {
            // 잔액 업데이트 또는 생성
            await client.query(
              `INSERT INTO point_balances (user_id, point_type, balance)
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id, point_type)
               DO UPDATE SET balance = point_balances.balance + $3`,
              [userId, refund.type, refund.amount]
            );

            // 환불 후 잔액 조회
            const balanceResult = await client.query(
              `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = $2`,
              [userId, refund.type]
            );
            const balanceAfter = parseFloat(balanceResult.rows[0]?.balance || 0);

            // 환불 트랜잭션 기록
            await client.query(
              `INSERT INTO point_transactions (id, user_id, point_type, transaction_type, amount, balance_after, description)
               VALUES ($1, $2, $3, 'refund', $4, $5, $6)`,
              [generateUUID(), userId, refund.type, refund.amount, balanceAfter,
               `주문 ${status === 'cancelled' ? '취소' : '환불'} - ${order.order_number}`]
            );
          }
        }

        // 5. 카드 결제 환불 처리 (페이링)
        const cardAmount = parseFloat(order.payment_card || 0);
        if (cardAmount > 0) {
          // 페이링 결제 취소 API 호출
          try {
            // 주문에 저장된 페이링 주문번호 사용, 없으면 payment_requests에서 조회
            let payringOrderId = order.payring_order_id;

            if (!payringOrderId) {
              // payment_requests 테이블에서 해당 주문의 페이링 주문번호 조회
              const paymentResult = await client.query(
                `SELECT order_id, payring_transaction_id, status FROM payment_requests
                 WHERE order_id LIKE $1 AND status = 'completed'
                 ORDER BY created_at DESC LIMIT 1`,
                [`%${order.order_number}%`]
              );

              if (paymentResult.rows.length > 0) {
                payringOrderId = paymentResult.rows[0].order_id;
              } else {
                payringOrderId = order.order_number;
              }
            }

            console.log(`[주문취소] 페이링 결제 취소 요청: 주문번호=${payringOrderId}, 금액=${cardAmount}원`);

            const cancelResult = await payringService.cancelPayment(payringOrderId, cardAmount);

            if (cancelResult.success) {
              console.log(`[주문취소] 페이링 결제 취소 성공: ${payringOrderId}`);

              // payment_requests 상태 업데이트
              await client.query(
                `UPDATE payment_requests SET status = 'cancelled', updated_at = NOW()
                 WHERE order_id = $1`,
                [payringOrderId]
              );
            } else {
              // 취소 실패 시 로그 기록 (주문 취소는 계속 진행)
              console.error(`[주문취소] 페이링 결제 취소 실패: ${cancelResult.error}`);

              // 실패 내역 기록
              await client.query(
                `UPDATE payment_requests
                 SET error_message = $1, updated_at = NOW()
                 WHERE order_id = $2`,
                [`환불 실패: ${cancelResult.error}`, payringOrderId]
              );
            }
          } catch (payringError: any) {
            // 페이링 API 오류 시 로그만 남기고 주문 취소는 진행
            console.error(`[주문취소] 페이링 API 오류:`, payringError.message);
          }
        }
      }

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateInvoiceNumber(orderId: string, invoiceNumber: string): Promise<Order> {
    const result = await query(
      `UPDATE orders SET invoice_number = $1, status = 'shipped' WHERE id = $2 RETURNING *`,
      [invoiceNumber, orderId]
    );

    if (result.rows.length === 0) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    return result.rows[0];
  }
}

export const orderService = new OrderService();
