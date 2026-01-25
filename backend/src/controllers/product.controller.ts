import { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { AdminAuthRequest, AuthRequest } from '../types';

export class ProductController {
  // Get all products (public)
  async getProducts(req: Request, res: Response) {
    try {
      const { page, limit, category, search } = req.query;

      const result = await productService.getProducts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        search: search as string,
        activeOnly: true
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get product by ID (public)
  async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: '상품을 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get products for dealer (shows dealer price)
  async getDealerProducts(req: AuthRequest, res: Response) {
    try {
      if (req.user?.grade !== 'dealer') {
        return res.status(403).json({
          success: false,
          error: '대리점 회원만 접근 가능합니다.'
        });
      }

      const { page, limit, category, search } = req.query;

      const result = await productService.getProducts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        search: search as string,
        activeOnly: true
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get all products (including inactive)
  async adminGetProducts(req: AdminAuthRequest, res: Response) {
    try {
      const { page, limit, category, search } = req.query;

      const result = await productService.getProducts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        search: search as string,
        activeOnly: false
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Create product
  async createProduct(req: AdminAuthRequest, res: Response) {
    try {
      const { name, description, price_krw, price_dealer_krw, pv_value, stock_quantity, category, image_url } = req.body;

      if (!name || !price_krw || !price_dealer_krw || pv_value === undefined) {
        return res.status(400).json({
          success: false,
          error: '상품명, 소비자가, 대리점가, PV는 필수입니다.'
        });
      }

      const product = await productService.createProduct({
        name,
        description,
        price_krw,
        price_dealer_krw,
        pv_value,
        stock_quantity,
        category,
        image_url
      });

      res.status(201).json({
        success: true,
        data: product,
        message: '상품이 등록되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update product
  async updateProduct(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const product = await productService.updateProduct(id, updateData);

      res.json({
        success: true,
        data: product,
        message: '상품이 수정되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update stock
  async updateStock(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined || quantity < 0) {
        return res.status(400).json({
          success: false,
          error: '유효한 재고 수량을 입력해주세요.'
        });
      }

      const product = await productService.updateStock(id, quantity);

      res.json({
        success: true,
        data: product,
        message: '재고가 수정되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Delete (deactivate) product
  async deleteProduct(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;

      await productService.deleteProduct(id);

      res.json({
        success: true,
        message: '상품이 삭제되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const productController = new ProductController();
