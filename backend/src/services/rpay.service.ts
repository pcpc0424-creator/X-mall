import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { RpayExcelRow } from '../utils/excel';

export interface BulkDepositResult {
  total: number;
  success_count: number;
  fail_count: number;
  errors: { row: number; username: string; error: string }[];
}

export class RpayService {
  async getBalance(userId: string): Promise<number> {
    const result = await query(
      `SELECT balance_krw FROM rpay_balance WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] ? parseFloat(result.rows[0].balance_krw) : 0;
  }

  async deposit(
    userId: string,
    amount: number,
    description?: string
  ): Promise<number> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Update balance
      const result = await client.query(
        `UPDATE rpay_balance
         SET balance_krw = balance_krw + $1
         WHERE user_id = $2
         RETURNING balance_krw`,
        [amount, userId]
      );

      const newBalance = parseFloat(result.rows[0].balance_krw);

      // Record transaction
      await client.query(
        `INSERT INTO rpay_transactions (id, user_id, amount, transaction_type, balance_after, description)
         VALUES ($1, $2, $3, 'deposit', $4, $5)`,
        [generateUUID(), userId, amount, newBalance, description || '충전']
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

  async deduct(
    userId: string,
    amount: number,
    referenceId: string,
    description?: string
  ): Promise<number> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check balance
      const balanceResult = await client.query(
        `SELECT balance_krw FROM rpay_balance WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      const currentBalance = parseFloat(balanceResult.rows[0]?.balance_krw || 0);

      if (currentBalance < amount) {
        throw new Error(`X페이 잔액이 부족합니다. (현재: ${currentBalance}원, 필요: ${amount}원)`);
      }

      // Update balance
      const result = await client.query(
        `UPDATE rpay_balance
         SET balance_krw = balance_krw - $1
         WHERE user_id = $2
         RETURNING balance_krw`,
        [amount, userId]
      );

      const newBalance = parseFloat(result.rows[0].balance_krw);

      // Record transaction
      await client.query(
        `INSERT INTO rpay_transactions (id, user_id, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, $3, 'payment', $4, $5, $6)`,
        [generateUUID(), userId, -amount, newBalance, referenceId, description || '결제']
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

  async refund(
    userId: string,
    amount: number,
    referenceId: string,
    description?: string
  ): Promise<number> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE rpay_balance
         SET balance_krw = balance_krw + $1
         WHERE user_id = $2
         RETURNING balance_krw`,
        [amount, userId]
      );

      const newBalance = parseFloat(result.rows[0].balance_krw);

      await client.query(
        `INSERT INTO rpay_transactions (id, user_id, amount, transaction_type, balance_after, reference_id, description)
         VALUES ($1, $2, $3, 'refund', $4, $5, $6)`,
        [generateUUID(), userId, amount, newBalance, referenceId, description || '환불']
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

  async getTransactionHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ transactions: any[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) FROM rpay_transactions WHERE user_id = $1`,
      [userId]
    );

    const result = await query(
      `SELECT * FROM rpay_transactions WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async adminDeposit(
    adminId: string,
    userId: string,
    amount: number,
    reason?: string
  ): Promise<number> {
    const description = `관리자 충전${reason ? `: ${reason}` : ''}`;
    return this.deposit(userId, amount, description);
  }

  async bulkDeposit(
    adminId: string,
    rows: RpayExcelRow[],
    startRowOffset: number = 2
  ): Promise<BulkDepositResult> {
    const result: BulkDepositResult = {
      total: rows.length,
      success_count: 0,
      fail_count: 0,
      errors: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + startRowOffset;

      try {
        // Find user by username
        const userResult = await query(
          'SELECT id, name FROM users WHERE username = $1 AND is_active = true',
          [row.username]
        );

        if (userResult.rows.length === 0) {
          result.errors.push({
            row: rowNumber,
            username: row.username,
            error: '존재하지 않는 회원'
          });
          result.fail_count++;
          continue;
        }

        const userId = userResult.rows[0].id;
        const amount = row.amount;
        const reason = row.reason || '일괄 충전';

        // Deposit R-pay
        await this.adminDeposit(adminId, userId, amount, reason);
        result.success_count++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          username: row.username,
          error: error.message || 'X페이 충전 실패'
        });
        result.fail_count++;
      }
    }

    return result;
  }
}

export const rpayService = new RpayService();
