import bcrypt from 'bcryptjs';
import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { User, UserGrade, SignupBody } from '../types';

export class UserService {
  async createUser(data: SignupBody, grade: UserGrade = 'consumer'): Promise<User> {
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
        `INSERT INTO users (id, email, password_hash, name, phone, grade)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, data.email, passwordHash, data.name, data.phone, grade]
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
}

export const userService = new UserService();
