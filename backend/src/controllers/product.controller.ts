import { Request, Response } from 'express';
import { productService } from '../services/product.service';
import { AdminAuthRequest, AuthRequest } from '../types';
import { parseProductsExcel } from '../utils/excel';

export class ProductController {
  // Get all products (public)
  async getProducts(req: Request, res: Response) {
    try {
      const { page, limit, category, subcategory, search } = req.query;

      const result = await productService.getProducts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        subcategory: subcategory as string,
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

  // Get product by ID (public) - includes package items if package
  async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await productService.getProductWithItems(id);

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
      const { page, limit, category, search, product_type } = req.query;

      const result = await productService.getProducts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        search: search as string,
        activeOnly: false,
        productType: product_type as any
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
      const { name, description, price_krw, price_dealer_krw, pv_value, stock_quantity, category, subcategory, image_url, product_type } = req.body;

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
        subcategory,
        image_url,
        product_type
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

  // Admin: Get product with package items
  async getProductWithItems(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const product = await productService.getProductWithItems(id);

      res.json({
        success: true,
        data: product
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get single products (for package composition)
  async getSingleProducts(req: AdminAuthRequest, res: Response) {
    try {
      const products = await productService.getSingleProducts();

      res.json({
        success: true,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get package items
  async getPackageItems(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const items = await productService.getPackageItems(id);

      res.json({
        success: true,
        data: items
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Set package items (replace all)
  async setPackageItems(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({
          success: false,
          error: '구성품 목록이 필요합니다.'
        });
      }

      // Validate items
      for (const item of items) {
        if (!item.single_product_id || !item.quantity || item.quantity < 1) {
          return res.status(400).json({
            success: false,
            error: '각 구성품에는 상품 ID와 수량(1 이상)이 필요합니다.'
          });
        }
      }

      const updatedItems = await productService.setPackageItems(id, items);

      res.json({
        success: true,
        data: updatedItems,
        message: '패키지 구성이 저장되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Add single item to package
  async addPackageItem(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { single_product_id, quantity } = req.body;

      if (!single_product_id || !quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          error: '상품 ID와 수량(1 이상)이 필요합니다.'
        });
      }

      const item = await productService.addPackageItem(id, single_product_id, quantity);

      res.json({
        success: true,
        data: item,
        message: '구성품이 추가되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Remove item from package
  async removePackageItem(req: AdminAuthRequest, res: Response) {
    try {
      const { id, itemId } = req.params;

      await productService.removePackageItem(id, itemId);

      res.json({
        success: true,
        message: '구성품이 삭제되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Bulk upload products from Excel
  async bulkUpload(req: AdminAuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '엑셀 파일을 업로드해주세요.'
        });
      }

      // Parse Excel file
      const parseResult = parseProductsExcel(req.file.buffer);

      // Collect all validation errors
      const allErrors = parseResult.errors.map(e => ({
        row: e.row,
        name: '-',
        error: e.message
      }));

      if (parseResult.data.length === 0 && allErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: '유효한 데이터가 없습니다.',
          data: {
            total: 0,
            success_count: 0,
            fail_count: allErrors.length,
            errors: allErrors
          }
        });
      }

      // Bulk create products
      const bulkResult = await productService.bulkCreateProducts(parseResult.data);

      // Merge errors
      const finalErrors = [...allErrors, ...bulkResult.errors];

      res.json({
        success: true,
        data: {
          total: parseResult.data.length + parseResult.errors.length,
          success_count: bulkResult.success_count,
          fail_count: parseResult.errors.length + bulkResult.fail_count,
          errors: finalErrors
        },
        message: `총 ${bulkResult.success_count}개의 상품이 등록되었습니다.`
      });
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '일괄 등록 중 오류가 발생했습니다.'
      });
    }
  }
}

export const productController = new ProductController();
