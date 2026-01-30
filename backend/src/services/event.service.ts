import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';

export interface Event {
  id: string;
  title: string;
  description?: string;
  content?: string;
  image_url?: string;
  banner_url?: string;
  event_type: 'promotion' | 'sale' | 'new_arrival' | 'special';
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  coupon_code?: string;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class EventService {
  // Get all events with optional filtering
  async getEvents(options: { activeOnly?: boolean; eventType?: string } = {}): Promise<Event[]> {
    const { activeOnly = false, eventType } = options;

    let sql = 'SELECT * FROM events';
    const params: any[] = [];
    const conditions: string[] = [];

    if (eventType) {
      params.push(eventType);
      conditions.push(`event_type = $${params.length}`);
    }

    if (activeOnly) {
      conditions.push('is_active = true');
      conditions.push('start_date <= NOW()');
      conditions.push('end_date >= NOW()');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY start_date DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  // Get single event by ID
  async getEventById(id: string): Promise<Event | null> {
    const result = await query('SELECT * FROM events WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // Get currently active events
  async getActiveEvents(): Promise<Event[]> {
    const result = await query(
      `SELECT * FROM events
       WHERE is_active = true
         AND start_date <= NOW()
         AND end_date >= NOW()
       ORDER BY start_date DESC`,
      []
    );
    return result.rows;
  }

  // Get upcoming events
  async getUpcomingEvents(): Promise<Event[]> {
    const result = await query(
      `SELECT * FROM events
       WHERE is_active = true
         AND start_date > NOW()
       ORDER BY start_date ASC`,
      []
    );
    return result.rows;
  }

  // Create event
  async createEvent(data: {
    title: string;
    description?: string;
    content?: string;
    image_url?: string;
    banner_url?: string;
    event_type?: string;
    discount_type?: string;
    discount_value?: number;
    coupon_code?: string;
    start_date: Date;
    end_date: Date;
  }): Promise<Event> {
    const result = await query(
      `INSERT INTO events (id, title, description, content, image_url, banner_url, event_type, discount_type, discount_value, coupon_code, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        generateUUID(),
        data.title,
        data.description || null,
        data.content || null,
        data.image_url || null,
        data.banner_url || null,
        data.event_type || 'promotion',
        data.discount_type || null,
        data.discount_value || null,
        data.coupon_code || null,
        data.start_date,
        data.end_date
      ]
    );
    return result.rows[0];
  }

  // Update event
  async updateEvent(id: string, data: Partial<{
    title: string;
    description: string;
    content: string;
    image_url: string;
    banner_url: string;
    event_type: string;
    discount_type: string;
    discount_value: number;
    coupon_code: string;
    start_date: Date;
    end_date: Date;
    is_active: boolean;
  }>): Promise<Event> {
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
      `UPDATE events SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('이벤트를 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  // Delete event
  async deleteEvent(id: string): Promise<void> {
    const result = await query('DELETE FROM events WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      throw new Error('이벤트를 찾을 수 없습니다.');
    }
  }

  // Get event statistics
  async getEventStats(): Promise<{ total: number; active: number; upcoming: number; expired: number }> {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true AND start_date <= NOW() AND end_date >= NOW()) as active,
        COUNT(*) FILTER (WHERE is_active = true AND start_date > NOW()) as upcoming,
        COUNT(*) FILTER (WHERE end_date < NOW()) as expired
       FROM events`,
      []
    );
    return {
      total: parseInt(result.rows[0].total),
      active: parseInt(result.rows[0].active),
      upcoming: parseInt(result.rows[0].upcoming),
      expired: parseInt(result.rows[0].expired)
    };
  }
}

export const eventService = new EventService();
