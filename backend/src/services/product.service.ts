import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { Product } from '../types';

export class ProductService {
  async getProducts(options: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    activeOnly?: boolean;
  } = {}): Promise<{ products: Product[]; total: number }> {
    const { page = 1, limit = 20, category, search, activeOnly = true } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (activeOnly) {
      conditions.push('is_active = true');
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM products ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      products: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    const result = await query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async createProduct(data: {
    name: string;
    description?: string;
    price_krw: number;
    price_dealer_krw: number;
    pv_value: number;
    stock_quantity?: number;
    category?: string;
    image_url?: string;
  }): Promise<Product> {
    const result = await query(
      `INSERT INTO products (id, name, description, price_krw, price_dealer_krw, pv_value, stock_quantity, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        generateUUID(),
        data.name,
        data.description,
        data.price_krw,
        data.price_dealer_krw,
        data.pv_value,
        data.stock_quantity || 0,
        data.category,
        data.image_url
      ]
    );
    return result.rows[0];
  }

  async updateProduct(id: string, data: Partial<{
    name: string;
    description: string;
    price_krw: number;
    price_dealer_krw: number;
    pv_value: number;
    stock_quantity: number;
    category: string;
    image_url: string;
    is_active: boolean;
  }>): Promise<Product> {
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

    values.push(id);
    const result = await query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('상품을 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const result = await query(
      `UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *`,
      [quantity, id]
    );

    if (result.rows.length === 0) {
      throw new Error('상품을 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  async deleteProduct(id: string): Promise<void> {
    await query(
      `UPDATE products SET is_active = false WHERE id = $1`,
      [id]
    );
  }
}

export const productService = new ProductService();
