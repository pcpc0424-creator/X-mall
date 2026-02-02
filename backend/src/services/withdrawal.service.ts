import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { getNextBusinessDay } from '../utils/business-day';
import { pointService } from './point.service';
import { PointWithdrawal, WithdrawalStatus } from '../types';

export class WithdrawalService {
  async createRequest(
    userId: string,
    data: {
      amount: number;
      bank_name: string;
      account_number: string;
      account_holder: string;
    }
  ): Promise<PointWithdrawal> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check P-point balance
      const balanceResult = await client.query(
        `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = 'P' FOR UPDATE`,
        [userId]
      );

      const currentBalance = parseFloat(balanceResult.rows[0]?.balance || 0);

      if (currentBalance < data.amount) {
        throw new Error(`P포인트 잔액이 부족합니다. (현재: ${currentBalance}, 요청: ${data.amount})`);
      }

      // Minimum withdrawal check
      if (data.amount < 10000) {
        throw new Error('최소 출금 금액은 10,000원입니다.');
      }

      const requestDate = new Date();
      const scheduledPaymentDate = await getNextBusinessDay(requestDate);

      const withdrawalId = generateUUID();

      // Deduct P-points immediately (hold)
      await client.query(
        `UPDATE point_balances SET balance = balance - $1 WHERE user_id = $2 AND point_type = 'P'`,
        [data.amount, userId]
      );

      // Get new balance for transaction record
      const newBalanceResult = await client.query(
        `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = 'P'`,
        [userId]
      );

      // Record transaction
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, 'P', $3, 'withdrawal', $4, $5, '출금 신청')`,
        [generateUUID(), userId, -data.amount, newBalanceResult.rows[0].balance, withdrawalId]
      );

      // Create withdrawal request
      const result = await client.query(
        `INSERT INTO point_withdrawals (id, user_id, amount, bank_name, account_number, account_holder, request_date, scheduled_payment_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [withdrawalId, userId, data.amount, data.bank_name, data.account_number, data.account_holder, requestDate, scheduledPaymentDate]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserWithdrawals(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ withdrawals: PointWithdrawal[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) FROM point_withdrawals WHERE user_id = $1`,
      [userId]
    );

    const result = await query(
      `SELECT * FROM point_withdrawals WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      withdrawals: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getAllWithdrawals(
    options: {
      status?: WithdrawalStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ withdrawals: any[]; total: number }> {
    const { status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause = `WHERE pw.status = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM point_withdrawals pw ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT pw.*, u.username, u.name as user_name
       FROM point_withdrawals pw
       JOIN users u ON pw.user_id = u.id
       ${whereClause}
       ORDER BY pw.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      withdrawals: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async approveWithdrawal(withdrawalId: string, adminNote?: string): Promise<PointWithdrawal> {
    const result = await query(
      `UPDATE point_withdrawals
       SET status = 'approved', admin_note = $2, processed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [withdrawalId, adminNote]
    );

    if (result.rows.length === 0) {
      throw new Error('출금 요청을 찾을 수 없거나 이미 처리되었습니다.');
    }

    return result.rows[0];
  }

  async rejectWithdrawal(withdrawalId: string, adminNote?: string): Promise<PointWithdrawal> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Get withdrawal info
      const withdrawalResult = await client.query(
        `SELECT * FROM point_withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE`,
        [withdrawalId]
      );

      if (withdrawalResult.rows.length === 0) {
        throw new Error('출금 요청을 찾을 수 없거나 이미 처리되었습니다.');
      }

      const withdrawal = withdrawalResult.rows[0];

      // Refund P-points
      await client.query(
        `UPDATE point_balances SET balance = balance + $1 WHERE user_id = $2 AND point_type = 'P'`,
        [withdrawal.amount, withdrawal.user_id]
      );

      const newBalanceResult = await client.query(
        `SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = 'P'`,
        [withdrawal.user_id]
      );

      // Record refund transaction
      await client.query(
        `INSERT INTO point_transactions (id, user_id, point_type, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, 'P', $3, 'refund', $4, $5, '출금 거절 환불')`,
        [generateUUID(), withdrawal.user_id, withdrawal.amount, newBalanceResult.rows[0].balance, withdrawalId]
      );

      // Update withdrawal status
      const result = await client.query(
        `UPDATE point_withdrawals
         SET status = 'rejected', admin_note = $2, processed_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [withdrawalId, adminNote]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeWithdrawal(withdrawalId: string): Promise<PointWithdrawal> {
    const result = await query(
      `UPDATE point_withdrawals
       SET status = 'completed', processed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'approved'
       RETURNING *`,
      [withdrawalId]
    );

    if (result.rows.length === 0) {
      throw new Error('승인된 출금 요청을 찾을 수 없습니다.');
    }

    return result.rows[0];
  }
}

export const withdrawalService = new WithdrawalService();
