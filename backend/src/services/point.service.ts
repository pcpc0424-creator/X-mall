import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { PointType, PointBalance } from '../types';
import { PointExcelRow } from '../utils/excel';

export interface BulkGrantResult {
  total: number;
  success_count: number;
  fail_count: number;
  errors: { row: number; username: string; error: string }[];
}

export class PointService {
  async getBalances(userId: string): Promise<{
    X: number;
    rpay: number;
  }> {
    // 단일 쿼리로 잔액 조회 (X포인트, X페이만)
    const result = await query(
      `SELECT
        COALESCE((SELECT balance FROM point_balances WHERE user_id = $1 AND point_type = 'X'), 0) as x_balance,
        COALESCE((SELECT balance_krw FROM rpay_balance WHERE user_id = $1), 0) as rpay_balance`,
      [userId]
    );

    const row = result.rows[0];
    return {
      X: parseFloat(row.x_balance),
      rpay: parseFloat(row.rpay_balance)
    };
  }

  // Get current exchange rate (USD to KRW)
  async getExchangeRate(): Promise<number> {
    const result = await query(
      `SELECT rate FROM exchange_rates WHERE rate_type = 'weekly' ORDER BY effective_date DESC LIMIT 1`
    );
    // Default rate if none found
    return result.rows[0] ? parseFloat(result.rows[0].rate) : 1400;
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

  // transferPoints removed - P/C/T point transfer no longer supported

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
    // X포인트만 지원 (관리자 수동 지급 허용)
    if (pointType !== 'X') {
      throw new Error('X포인트만 지급할 수 있습니다.');
    }
    const description = `관리자 지급${reason ? `: ${reason}` : ''}`;
    return this.addPoints(userId, pointType, amount, 'grant', adminId, description);
  }

  async adminDeductPoints(
    adminId: string,
    userId: string,
    pointType: PointType,
    amount: number,
    reason?: string
  ): Promise<number> {
    // X포인트만 지원
    if (pointType !== 'X') {
      throw new Error('X포인트만 차감할 수 있습니다.');
    }
    const description = `관리자 차감${reason ? `: ${reason}` : ''}`;
    return this.deductPoints(userId, pointType, amount, 'admin_deduct', adminId, description);
  }

  async bulkGrantPoints(
    adminId: string,
    rows: PointExcelRow[],
    startRowOffset: number = 2
  ): Promise<BulkGrantResult> {
    const result: BulkGrantResult = {
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
        const pointType = row.point_type as PointType;
        const amount = row.amount;
        const reason = row.reason || '일괄 지급';

        // Grant points
        await this.adminGrantPoints(adminId, userId, pointType, amount, reason);
        result.success_count++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          username: row.username,
          error: error.message || '포인트 지급 실패'
        });
        result.fail_count++;
      }
    }

    return result;
  }
}

export const pointService = new PointService();
