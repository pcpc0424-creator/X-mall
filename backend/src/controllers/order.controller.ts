import { Response } from 'express';
import { orderService } from '../services/order.service';
import { AuthRequest, AdminAuthRequest, CreateOrderBody } from '../types';

export class OrderController {
  // Create order (dealer only)
  async createOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const userGrade = req.user!.grade;
      const orderData: CreateOrderBody = req.body;

      if (!orderData.items || orderData.items.length === 0) {
        return res.status(400).json({
          success: false,
          error: '주문 상품이 없습니다.'
        });
      }

      if (!orderData.shipping || !orderData.shipping.name || !orderData.shipping.phone || !orderData.shipping.address) {
        return res.status(400).json({
          success: false,
          error: '배송 정보를 입력해주세요.'
        });
      }

      const order = await orderService.createOrder(userId, userGrade, orderData);

      res.status(201).json({
        success: true,
        data: order,
        message: '주문이 완료되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get user's orders
  async getUserOrders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { page, limit, status } = req.query;

      const result = await orderService.getUserOrders(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as any
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

  // Get order by ID (user)
  async getOrderById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const order = await orderService.getOrderById(id);

      // Verify ownership
      if (order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: '접근 권한이 없습니다.'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get all orders
  async getAllOrders(req: AdminAuthRequest, res: Response) {
    try {
      const { page, limit, status, search, start_date, end_date } = req.query;

      const result = await orderService.getAllOrders({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as any,
        search: search as string,
        startDate: start_date as string,
        endDate: end_date as string
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

  // Admin: Get order by ID
  async adminGetOrderById(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id);

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update order status
  async updateOrderStatus(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: '유효한 주문 상태를 입력해주세요.'
        });
      }

      const order = await orderService.updateOrderStatus(id, status);

      res.json({
        success: true,
        data: order,
        message: '주문 상태가 변경되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update invoice number
  async updateInvoiceNumber(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { invoice_number } = req.body;

      if (!invoice_number) {
        return res.status(400).json({
          success: false,
          error: '송장번호를 입력해주세요.'
        });
      }

      const order = await orderService.updateInvoiceNumber(id, invoice_number);

      res.json({
        success: true,
        data: order,
        message: '송장번호가 등록되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const orderController = new OrderController();
