import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  children?: Category[];
  product_count?: number;
}

export class CategoryService {
  // Get all categories with optional hierarchy
  async getCategories(options: { includeChildren?: boolean; activeOnly?: boolean } = {}): Promise<Category[]> {
    const { includeChildren = true, activeOnly = true } = options;

    let sql = 'SELECT * FROM categories';
    const params: any[] = [];

    if (activeOnly) {
      sql += ' WHERE is_active = true';
    }

    sql += ' ORDER BY sort_order ASC, name ASC';

    const result = await query(sql, params);
    const categories = result.rows;

    if (includeChildren) {
      // Build hierarchy
      const rootCategories = categories.filter((c: Category) => !c.parent_id);
      return rootCategories.map((parent: Category) => ({
        ...parent,
        children: categories.filter((c: Category) => c.parent_id === parent.id)
      }));
    }

    return categories;
  }

  // Get single category by ID or slug
  async getCategoryById(idOrSlug: string): Promise<Category | null> {
    const result = await query(
      'SELECT * FROM categories WHERE id = $1 OR slug = $1',
      [idOrSlug]
    );
    return result.rows[0] || null;
  }

  // Get category with product count
  async getCategoryWithProductCount(id: string): Promise<Category | null> {
    const result = await query(
      `SELECT c.*, COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Create category
  async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    parent_id?: string;
    sort_order?: number;
  }): Promise<Category> {
    const result = await query(
      `INSERT INTO categories (id, name, slug, description, image_url, parent_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        generateUUID(),
        data.name,
        data.slug,
        data.description,
        data.image_url,
        data.parent_id || null,
        data.sort_order || 0
      ]
    );
    return result.rows[0];
  }

  // Update category
  async updateCategory(id: string, data: Partial<{
    name: string;
    slug: string;
    description: string;
    image_url: string;
    parent_id: string;
    sort_order: number;
    is_active: boolean;
  }>): Promise<Category> {
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
      `UPDATE categories SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('카테고리를 찾을 수 없습니다.');
    }

    return result.rows[0];
  }

  // Delete category
  async deleteCategory(id: string): Promise<void> {
    // Check if category has products
    const productCount = await query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1',
      [id]
    );

    if (parseInt(productCount.rows[0].count) > 0) {
      throw new Error('이 카테고리에 속한 상품이 있어 삭제할 수 없습니다.');
    }

    // Check if category has children
    const childCount = await query(
      'SELECT COUNT(*) FROM categories WHERE parent_id = $1',
      [id]
    );

    if (parseInt(childCount.rows[0].count) > 0) {
      throw new Error('하위 카테고리가 있어 삭제할 수 없습니다.');
    }

    await query('DELETE FROM categories WHERE id = $1', [id]);
  }

  // Get subcategories
  async getSubcategories(parentId: string): Promise<Category[]> {
    const result = await query(
      'SELECT * FROM categories WHERE parent_id = $1 ORDER BY sort_order ASC',
      [parentId]
    );
    return result.rows;
  }
}

export const categoryService = new CategoryService();
