import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { User, UserGrade, SignupBody } from '../types';
import { MemberExcelRow } from '../utils/excel';

export interface BulkCreateResult {
  total: number;
  success_count: number;
  fail_count: number;
  errors: { row: number; email: string; error: string }[];
}

export class UserService {
  async createUser(data: SignupBody, grade: UserGrade = 'consumer', referrerId?: string): Promise<User> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check if email already exists
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [data.email]
      );

      if (existing.rows.length > 0) {
        throw new Error('이미 사용 중인 이메일입니다.');
      }

      const userId = generateUUID();
      const passwordHash = await bcrypt.hash(data.password, 10);

      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, name, phone, grade, referrer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, data.email, passwordHash, data.name, data.phone, grade, referrerId || null]
      );

      // Initialize point balances
      await client.query(
        `INSERT INTO point_balances (user_id, point_type, balance)
         VALUES ($1, 'P', 0), ($1, 'C', 0), ($1, 'T', 0)`,
        [userId]
      );

      // Initialize R-pay balance
      await client.query(
        `INSERT INTO rpay_balance (user_id, balance_krw)
         VALUES ($1, 0)`,
        [userId]
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

  async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  async updateGrade(userId: string, grade: UserGrade): Promise<User> {
    const result = await query(
      `UPDATE users SET grade = $1 WHERE id = $2 RETURNING *`,
      [grade, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  async getUsers(options: {
    page?: number;
    limit?: number;
    grade?: UserGrade;
    search?: string;
  } = {}): Promise<{ users: User[]; total: number }> {
    const { page = 1, limit = 20, grade, search } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE is_active = true';
    const params: any[] = [];

    if (grade) {
      params.push(grade);
      whereClause += ` AND grade = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT id, email, name, phone, grade, is_active, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async deactivateUser(userId: string): Promise<void> {
    await query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [userId]
    );
  }

  async bulkCreateUsers(rows: MemberExcelRow[], startRowOffset: number = 2): Promise<BulkCreateResult> {
    const result: BulkCreateResult = {
      total: rows.length,
      success_count: 0,
      fail_count: 0,
      errors: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + startRowOffset;

      try {
        // Check if email already exists
        const existing = await query(
          'SELECT id FROM users WHERE email = $1',
          [row.email]
        );

        if (existing.rows.length > 0) {
          result.errors.push({
            row: rowNumber,
            email: row.email,
            error: '이미 존재하는 이메일'
          });
          result.fail_count++;
          continue;
        }

        const client = await getClient();
        try {
          await client.query('BEGIN');

          const userId = generateUUID();
          const passwordHash = await bcrypt.hash(row.password, 10);
          const grade: UserGrade = (row.grade === 'dealer' ? 'dealer' : 'consumer');

          await client.query(
            `INSERT INTO users (id, email, password_hash, name, phone, grade)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, row.email, passwordHash, row.name, row.phone, grade]
          );

          // Initialize point balances
          await client.query(
            `INSERT INTO point_balances (user_id, point_type, balance)
             VALUES ($1, 'P', 0), ($1, 'C', 0), ($1, 'T', 0)`,
            [userId]
          );

          // Initialize R-pay balance
          await client.query(
            `INSERT INTO rpay_balance (user_id, balance_krw)
             VALUES ($1, 0)`,
            [userId]
          );

          await client.query('COMMIT');
          result.success_count++;
        } catch (error: any) {
          await client.query('ROLLBACK');
          result.errors.push({
            row: rowNumber,
            email: row.email,
            error: error.message || '사용자 생성 실패'
          });
          result.fail_count++;
        } finally {
          client.release();
        }
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          email: row.email,
          error: error.message || '처리 중 오류'
        });
        result.fail_count++;
      }
    }

    return result;
  }

  async findDealerByEmail(email: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND grade = $2 AND is_active = true',
      [email, 'dealer']
    );
    return result.rows[0] || null;
  }

  async getDealers(options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{ dealers: User[]; total: number }> {
    const { page = 1, limit = 100, search } = options;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE grade = 'dealer' AND is_active = true";
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT id, email, name, phone, grade, is_active, created_at
       FROM users ${whereClause}
       ORDER BY name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      dealers: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getGenealogy(dealerId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{
    members: any[];
    total: number;
    summary: { total_members: number; total_purchase_krw: number; total_pv: number };
  }> {
    const { page = 1, limit = 20, search } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE u.referrer_id = $1 AND u.is_active = true';
    const params: any[] = [dealerId];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    // Count total members
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );

    // Get members with purchase stats
    const membersParams = [...params, limit, offset];
    const membersResult = await query(
      `SELECT
        u.id,
        u.email,
        u.name,
        u.phone,
        u.grade,
        u.is_active,
        u.created_at,
        COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total_krw ELSE 0 END), 0) as total_purchase_krw,
        COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total_pv ELSE 0 END), 0) as total_pv
       FROM users u
       LEFT JOIN orders o ON u.id = o.user_id
       ${whereClause}
       GROUP BY u.id, u.email, u.name, u.phone, u.grade, u.is_active, u.created_at
       ORDER BY u.created_at DESC
       LIMIT $${membersParams.length - 1} OFFSET $${membersParams.length}`,
      membersParams
    );

    // Get summary (all members under this dealer)
    const summaryResult = await query(
      `SELECT
        COUNT(DISTINCT u.id) as total_members,
        COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total_krw ELSE 0 END), 0) as total_purchase_krw,
        COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'refunded') THEN o.total_pv ELSE 0 END), 0) as total_pv
       FROM users u
       LEFT JOIN orders o ON u.id = o.user_id
       WHERE u.referrer_id = $1 AND u.is_active = true`,
      [dealerId]
    );

    return {
      members: membersResult.rows.map(m => ({
        ...m,
        total_purchase_krw: parseInt(m.total_purchase_krw) || 0,
        total_pv: parseInt(m.total_pv) || 0
      })),
      total: parseInt(countResult.rows[0].count),
      summary: {
        total_members: parseInt(summaryResult.rows[0].total_members) || 0,
        total_purchase_krw: parseInt(summaryResult.rows[0].total_purchase_krw) || 0,
        total_pv: parseInt(summaryResult.rows[0].total_pv) || 0
      }
    };
  }
}

export const userService = new UserService();
