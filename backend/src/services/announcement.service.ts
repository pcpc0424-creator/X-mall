import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_important: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class AnnouncementService {
  async getAnnouncements(options: {
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  } = {}): Promise<{ announcements: Announcement[]; total: number; totalPages: number }> {
    const { page = 1, limit = 20, activeOnly = false } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (activeOnly) {
      conditions.push('is_active = true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM announcements ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM announcements ${whereClause}
       ORDER BY is_important DESC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      announcements: result.rows,
      total,
      totalPages
    };
  }

  async getAnnouncementById(id: string): Promise<Announcement | null> {
    const result = await query(
      'SELECT * FROM announcements WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async createAnnouncement(data: {
    title: string;
    content: string;
    is_important?: boolean;
  }): Promise<Announcement> {
    const result = await query(
      `INSERT INTO announcements (id, title, content, is_important, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [
        generateUUID(),
        data.title,
        data.content,
        data.is_important || false
      ]
    );
    return result.rows[0];
  }

  async updateAnnouncement(id: string, data: Partial<{
    title: string;
    content: string;
    is_important: boolean;
    is_active: boolean;
  }>): Promise<Announcement> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        values.push(value);
        fields.push(`${key} = $${values.length}`);
      }
    });

    if (fields.length === 0) {
      throw new Error('업데이트할 필드가 없습니다.');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('공지사항을 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await query(
      'DELETE FROM announcements WHERE id = $1',
      [id]
    );
  }
}

export const announcementService = new AnnouncementService();
