import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image_url: string;
  link_url?: string;
  button_text?: string;
  position: 'hero' | 'category' | 'promotion';
  sort_order: number;
  is_active: boolean;
  start_date?: Date;
  end_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export class BannerService {
  // Get all banners with optional filtering
  async getBanners(options: { position?: string; activeOnly?: boolean } = {}): Promise<Banner[]> {
    const { position, activeOnly = false } = options;

    let sql = 'SELECT * FROM banners';
    const params: any[] = [];
    const conditions: string[] = [];

    if (position) {
      params.push(position);
      conditions.push(`position = $${params.length}`);
    }

    if (activeOnly) {
      conditions.push('is_active = true');
      conditions.push('(start_date IS NULL OR start_date <= NOW())');
      conditions.push('(end_date IS NULL OR end_date >= NOW())');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  // Get single banner by ID
  async getBannerById(id: string): Promise<Banner | null> {
    const result = await query('SELECT * FROM banners WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // Get active hero banners for homepage
  async getActiveHeroBanners(): Promise<Banner[]> {
    const result = await query(
      `SELECT * FROM banners
       WHERE position = 'hero'
         AND is_active = true
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())
       ORDER BY sort_order ASC`,
      []
    );
    return result.rows;
  }

  // Create banner
  async createBanner(data: {
    title: string;
    subtitle?: string;
    description?: string;
    image_url: string;
    link_url?: string;
    button_text?: string;
    position?: string;
    sort_order?: number;
    start_date?: Date;
    end_date?: Date;
  }): Promise<Banner> {
    const result = await query(
      `INSERT INTO banners (id, title, subtitle, description, image_url, link_url, button_text, position, sort_order, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        generateUUID(),
        data.title,
        data.subtitle || null,
        data.description || null,
        data.image_url,
        data.link_url || null,
        data.button_text || null,
        data.position || 'hero',
        data.sort_order || 0,
        data.start_date || null,
        data.end_date || null
      ]
    );
    return result.rows[0];
  }

  // Update banner
  async updateBanner(id: string, data: Partial<{
    title: string;
    subtitle: string;
    description: string;
    image_url: string;
    link_url: string;
    button_text: string;
    position: string;
    sort_order: number;
    is_active: boolean;
    start_date: Date;
    end_date: Date;
  }>): Promise<Banner> {
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
      `UPDATE banners SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('배너를 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  // Delete banner
  async deleteBanner(id: string): Promise<void> {
    const result = await query('DELETE FROM banners WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new Error('배너를 찾을 수 없습니다.');
    }
  }
}

export const bannerService = new BannerService();
