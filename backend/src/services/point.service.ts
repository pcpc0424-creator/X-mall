import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { PointType, PointBalance } from '../types';

export class PointService {
  async getBalances(userId: string): Promise<{
    P: number;
    C: number;
    T: number;
    rpay: number;
  }> {
    const pointResult = await query(
      `SELECT point_type, balance FROM point_balances WHERE user_id = $1`,
      [userId]
    );

    const rpayResult = await query(
      `SELECT balance_krw FROM rpay_balance WHERE user_id = $1`,
      [userId]
    );

    const balances: { P: number; C: number; T: number; rpay: number } = {
      P: 0,
      C: 0,
      T: 0,
      rpay: 0
    };

    for (const row of pointResult.rows) {
      balances[row.point_type as PointType] = parseFloat(row.balance);
    }

    if (rpayResult.rows[0]) {
      balances.rpay = parseFloat(rpayResult.rows[0].balance_krw);
    }

    return balances;
  }

  async getBalance(userId: string, pointType: PointType): Promise<number> {
    const result = await query(
      `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = $2`,
      [userId, pointType]
    );
    return result.rows[0] ? parseFloat(result.rows[0].balance) : 0;
  }

  async addPoints(
    userId: string,
    pointType: PointType,
    amount: number,
    transactionType: string,
    referenceId?: string,
    description?: string
  ): Promise<number> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Upsert balance (insert if not exists, update if exists)
      const result = await client.query(
        `INSERT INTO point_balances (user_id, point_type, balance)
         VALUES ($2, $3, $1)
         ON CONFLICT (user_id, point_type)
         DO UPDATE SET balance = point_balances.balance + $1, updated_at = NOW()
         RETURNING balance`,
        [amount, userId, pointType]
      );

      const newBalance = parseFloat(result.rows[0].balance);

      // Record transaction
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [generateUUID(), userId, pointType, amount, transactionType, newBalance, referenceId, description]
      );

      await client.query('COMMIT');
      return newBalance;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deductPoints(
    userId: string,
    pointType: PointType,
    amount: number,
    transactionType: string,
    referenceId?: string,
    description?: string
  ): Promise<number> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check current balance
      const balanceResult = await client.query(
        `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = $2 FOR UPDATE`,
        [userId, pointType]
      );

      const currentBalance = parseFloat(balanceResult.rows[0]?.balance || 0);

      if (currentBalance < amount) {
        throw new Error(`${pointType}포인트 잔액이 부족합니다. (현재: ${currentBalance}, 필요: ${amount})`);
      }

      // Update balance
      const result = await client.query(
        `UPDATE point_balances
         SET balance = balance - $1
         WHERE user_id = $2 AND point_type = $3
         RETURNING balance`,
        [amount, userId, pointType]
      );

      const newBalance = parseFloat(result.rows[0].balance);

      // Record transaction
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [generateUUID(), userId, pointType, -amount, transactionType, newBalance, referenceId, description]
      );

      await client.query('COMMIT');
      return newBalance;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async transferPoints(
    fromUserId: string,
    toUserId: string,
    fromPointType: 'P' | 'C',
    amount: number
  ): Promise<void> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check sender's balance
      const balanceResult = await client.query(
        `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = $2 FOR UPDATE`,
        [fromUserId, fromPointType]
      );

      const currentBalance = parseFloat(balanceResult.rows[0]?.balance || 0);

      if (currentBalance < amount) {
        throw new Error(`${fromPointType}포인트 잔액이 부족합니다.`);
      }

      // Deduct from sender (P or C)
      const senderNewBalance = await client.query(
        `UPDATE point_balances SET balance = balance - $1 WHERE user_id = $2 AND point_type = $3 RETURNING balance`,
        [amount, fromUserId, fromPointType]
      );

      // Add to receiver (always T point)
      const receiverNewBalance = await client.query(
        `UPDATE point_balances SET balance = balance + $1 WHERE user_id = $2 AND point_type = 'T' RETURNING balance`,
        [amount, toUserId]
      );

      const transferId = generateUUID();

      // Record transfer
      await client.query(
        `INSERT INTO point_transfers (id, from_user_id, to_user_id, from_point_type, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [transferId, fromUserId, toUserId, fromPointType, amount]
      );

      // Record transactions
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, $3, $4, 'transfer_out', $5, $6, $7)`,
        [generateUUID(), fromUserId, fromPointType, -amount, senderNewBalance.rows[0].balance, transferId, `포인트 이체 (${toUserId}에게)`]
      );

      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, 'T', $3, 'transfer_in', $4, $5, $6)`,
        [generateUUID(), toUserId, amount, receiverNewBalance.rows[0].balance, transferId, `포인트 이체 받음 (${fromUserId}로부터)`]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTransactionHistory(
    userId: string,
    options: {
      pointType?: PointType;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ transactions: any[]; total: number }> {
    const { pointType, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];

    if (pointType) {
      params.push(pointType);
      whereClause += ` AND point_type = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM point_transactions ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM point_transactions ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async adminGrantPoints(
    adminId: string,
    userId: string,
    pointType: PointType,
    amount: number,
    reason?: string
  ): Promise<number> {
    const description = `관리자 지급${reason ? `: ${reason}` : ''}`;
    return this.addPoints(userId, pointType, amount, 'grant', adminId, description);
  }
}

export const pointService = new PointService();
