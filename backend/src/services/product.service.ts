import { query, getClient } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { Product, PackageItem, ProductType } from '../types';

export class ProductService {
  async getProducts(options: {
    page?: number;
    limit?: number;
    category?: string;
    subcategory?: string;
    search?: string;
    activeOnly?: boolean;
    productType?: ProductType;
  } = {}): Promise<{ products: Product[]; total: number; totalPages: number; page: number; limit: number }> {
    const { page = 1, limit = 20, category, subcategory, search, activeOnly = true, productType } = options;
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

    if (subcategory) {
      params.push(subcategory);
      conditions.push(`subcategory = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    if (productType) {
      params.push(productType);
      conditions.push(`product_type = $${params.length}`);
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

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    return {
      products: result.rows,
      total,
      totalPages,
      page,
      limit
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
    subcategory?: string;
    image_url?: string;
    product_type?: ProductType;
  }): Promise<Product> {
    const result = await query(
      `INSERT INTO products (id, name, description, price_krw, price_dealer_krw, pv_value, stock_quantity, category, subcategory, image_url, product_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        data.subcategory,
        data.image_url,
        data.product_type || 'single'
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
    subcategory: string;
    image_url: string;
    product_type: ProductType;
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
    // 패키지 구성품으로 사용되는 경우 먼저 삭제
    await query(
      `DELETE FROM package_items WHERE single_product_id = $1`,
      [id]
    );
    // 상품 실제 삭제
    await query(
      `DELETE FROM products WHERE id = $1`,
      [id]
    );
  }

  // Package Items Methods
  async getPackageItems(packageId: string): Promise<PackageItem[]> {
    const result = await query(
      `SELECT pi.*, p.name as single_product_name, p.price_krw as single_product_price, p.pv_value as single_product_pv
       FROM package_items pi
       JOIN products p ON pi.single_product_id = p.id
       WHERE pi.package_id = $1
       ORDER BY p.name`,
      [packageId]
    );
    return result.rows;
  }

  async addPackageItem(packageId: string, singleProductId: string, quantity: number): Promise<PackageItem> {
    const result = await query(
      `INSERT INTO package_items (id, package_id, single_product_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (package_id, single_product_id)
       DO UPDATE SET quantity = $4
       RETURNING *`,
      [generateUUID(), packageId, singleProductId, quantity]
    );
    return result.rows[0];
  }

  async updatePackageItem(packageId: string, singleProductId: string, quantity: number): Promise<PackageItem> {
    const result = await query(
      `UPDATE package_items SET quantity = $1
       WHERE package_id = $2 AND single_product_id = $3
       RETURNING *`,
      [quantity, packageId, singleProductId]
    );

    if (result.rows.length === 0) {
      throw new Error('패키지 구성품을 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  async removePackageItem(packageId: string, singleProductId: string): Promise<void> {
    await query(
      `DELETE FROM package_items WHERE package_id = $1 AND single_product_id = $2`,
      [packageId, singleProductId]
    );
  }

  async setPackageItems(packageId: string, items: { single_product_id: string; quantity: number }[]): Promise<PackageItem[]> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Remove existing items
      await client.query(
        `DELETE FROM package_items WHERE package_id = $1`,
        [packageId]
      );

      // Add new items
      for (const item of items) {
        await client.query(
          `INSERT INTO package_items (id, package_id, single_product_id, quantity)
           VALUES ($1, $2, $3, $4)`,
          [generateUUID(), packageId, item.single_product_id, item.quantity]
        );
      }

      await client.query('COMMIT');

      // Return updated items
      return this.getPackageItems(packageId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get product with package items if it's a package
  async getProductWithItems(id: string): Promise<Product & { package_items?: PackageItem[] }> {
    const product = await this.getProductById(id);

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다.');
    }

    if (product.product_type === 'package') {
      const packageItems = await this.getPackageItems(id);
      return { ...product, package_items: packageItems };
    }

    return product;
  }

  // Get only single products (for package composition)
  async getSingleProducts(): Promise<Product[]> {
    const result = await query(
      `SELECT * FROM products WHERE product_type = 'single' AND is_active = true ORDER BY name`
    );
    return result.rows;
  }

  // Get bestseller products based on sales volume
  async getBestsellers(options: {
    limit?: number;
    category?: string;
  } = {}): Promise<Product[]> {
    const { limit = 8, category } = options;
    const params: any[] = [];

    let categoryCondition = '';
    if (category && category !== 'all') {
      params.push(category);
      categoryCondition = `AND p.category = $${params.length}`;
    }

    params.push(limit);

    // 판매량 기반 베스트셀러 쿼리 (최근 90일 기준)
    const result = await query(
      `SELECT p.*, COALESCE(SUM(oi.quantity), 0) as total_sold
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       LEFT JOIN orders o ON oi.order_id = o.id
         AND o.status NOT IN ('cancelled', 'refunded')
         AND o.created_at >= NOW() - INTERVAL '90 days'
       WHERE p.is_active = true ${categoryCondition}
       GROUP BY p.id
       ORDER BY total_sold DESC, p.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return result.rows;
  }

  // Bulk create products
  async bulkCreateProducts(rows: {
    name: string;
    price_krw: number;
    price_dealer_krw: number;
    pv_value: number;
    stock_quantity?: number;
    category?: string;
    description?: string;
    image_url?: string;
    product_type?: string;
  }[]): Promise<{
    total: number;
    success_count: number;
    fail_count: number;
    errors: { row: number; name: string; error: string }[];
  }> {
    const result = {
      total: rows.length,
      success_count: 0,
      fail_count: 0,
      errors: [] as { row: number; name: string; error: string }[]
    };

    const client = await getClient();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // Excel row number

        try {
          // Check for duplicate product name
          const existingProduct = await client.query(
            'SELECT id FROM products WHERE name = $1',
            [row.name]
          );

          if (existingProduct.rows.length > 0) {
            result.errors.push({
              row: rowNumber,
              name: row.name,
              error: '이미 존재하는 상품명'
            });
            result.fail_count++;
            continue;
          }

          // Insert product
          await client.query(
            `INSERT INTO products (id, name, description, price_krw, price_dealer_krw, pv_value, stock_quantity, category, image_url, product_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              generateUUID(),
              row.name,
              row.description || null,
              row.price_krw,
              row.price_dealer_krw,
              row.pv_value,
              row.stock_quantity || 0,
              row.category || null,
              row.image_url || null,
              row.product_type || 'single'
            ]
          );

          result.success_count++;
        } catch (error: any) {
          result.errors.push({
            row: rowNumber,
            name: row.name,
            error: error.message || '알 수 없는 오류'
          });
          result.fail_count++;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return result;
  }
}

export const productService = new ProductService();
