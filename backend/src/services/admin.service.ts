import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { AdminUser } from '../types';

export class AdminService {
  async findByUsername(username: string): Promise<AdminUser | null> {
    const result = await query(
      'SELECT * FROM admin_users WHERE username = $1 AND is_active = true',
      [username]
    );
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<AdminUser | null> {
    const result = await query(
      'SELECT * FROM admin_users WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  }

  async verifyPassword(admin: AdminUser, password: string): Promise<boolean> {
    return bcrypt.compare(password, admin.password_hash);
  }

  async createAdmin(data: {
    username: string;
    password: string;
    name: string;
    role?: string;
  }): Promise<AdminUser> {
    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('이미 사용 중인 관리자 아이디입니다.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await query(
      `INSERT INTO admin_users (id, username, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [generateUUID(), data.username, passwordHash, data.name, data.role || 'admin']
    );

    return result.rows[0];
  }

  async getAdmins(): Promise<AdminUser[]> {
    const result = await query(
      `SELECT id, username, name, role, created_at
       FROM admin_users WHERE is_active = true
       ORDER BY created_at DESC`
    );
    return result.rows;
  }
}

export const adminService = new AdminService();
