import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';

export class CategoryController {
  // Get all categories
  async getCategories(req: Request, res: Response) {
    try {
      const includeChildren = req.query.includeChildren !== 'false';
      const activeOnly = req.query.activeOnly !== 'false';

      const categories = await categoryService.getCategories({ includeChildren, activeOnly });

      res.json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get single category
  async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: '카테고리를 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get category with product count
  async getCategoryWithProductCount(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryWithProductCount(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          error: '카테고리를 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get subcategories
  async getSubcategories(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const subcategories = await categoryService.getSubcategories(id);

      res.json({
        success: true,
        data: subcategories
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create category (admin)
  async createCategory(req: Request, res: Response) {
    try {
      const { name, slug, description, image_url, parent_id, sort_order } = req.body;

      if (!name || !slug) {
        return res.status(400).json({
          success: false,
          error: '카테고리명과 슬러그는 필수입니다.'
        });
      }

      const category = await categoryService.createCategory({
        name,
        slug,
        description,
        image_url,
        parent_id,
        sort_order
      });

      res.status(201).json({
        success: true,
        data: category
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update category (admin)
  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const category = await categoryService.updateCategory(id, data);

      res.json({
        success: true,
        data: category
      });
    } catch (error: any) {
      if (error.message.includes('찾을 수 없습니다')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Delete category (admin)
  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await categoryService.deleteCategory(id);

      res.json({
        success: true,
        message: '카테고리가 삭제되었습니다.'
      });
    } catch (error: any) {
      if (error.message.includes('삭제할 수 없습니다') || error.message.includes('찾을 수 없습니다')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const categoryController = new CategoryController();
