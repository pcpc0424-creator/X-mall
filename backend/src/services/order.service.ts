import { query, getClient } from '../config/database';
import { generateUUID, generateOrderNumber } from '../utils/helpers';
import { getPPointReleaseDate } from '../utils/business-day';
import { rpayService } from './rpay.service';
import { pointService } from './point.service';
import { Order, OrderStatus, CreateOrderBody, Product } from '../types';

export class OrderService {
  async createOrder(
    userId: string,
    userGrade: 'dealer' | 'consumer',
    data: CreateOrderBody
  ): Promise<Order> {
    // Only dealers can place orders
    if (userGrade !== 'dealer') {
      throw new Error('대리점 회원만 주문할 수 있습니다.');
    }

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

        const unitPrice = parseFloat(product.price_dealer_krw.toString());
        const unitPv = parseFloat(product.pv_value.toString());
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
          throw new Error('R페이 잔액이 부족합니다.');
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
         shipping_name, shipping_phone, shipping_address, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'paid')
         RETURNING *`,
        [orderId, orderNumber, userId, totalPv, totalKrw,
         payment.rpay || 0, payment.ppoint || 0, payment.cpoint || 0, payment.tpoint || 0,
         payment.card || 0, payment.bank || 0,
         data.shipping.name, data.shipping.phone, data.shipping.address]
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
      conditions.push(`(o.order_number ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
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
      `SELECT o.*, u.name as user_name, u.email as user_email
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
      `SELECT o.*, u.name as user_name, u.email as user_email
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
    const result = await query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    if (result.rows.length === 0) {
      throw new Error('주문을 찾을 수 없습니다.');
    }

    // If cancelled, cancel pending P-points
    if (status === 'cancelled' || status === 'refunded') {
      await query(
        `UPDATE pending_ppoints SET status = 'cancelled' WHERE order_id = $1 AND status = 'pending'`,
        [orderId]
      );
    }

    return result.rows[0];
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
