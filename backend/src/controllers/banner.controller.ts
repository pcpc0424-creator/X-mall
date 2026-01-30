import { Request, Response } from 'express';
import { bannerService } from '../services/banner.service';

export class BannerController {
  // Get all banners
  async getBanners(req: Request, res: Response) {
    try {
      const position = req.query.position as string | undefined;
      const activeOnly = req.query.activeOnly === 'true';

      const banners = await bannerService.getBanners({ position, activeOnly });

      res.json({
        success: true,
        data: banners
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get single banner
  async getBannerById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const banner = await bannerService.getBannerById(id);

      if (!banner) {
        return res.status(404).json({
          success: false,
          error: '배너를 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: banner
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get active hero banners (public)
  async getActiveHeroBanners(req: Request, res: Response) {
    try {
      const banners = await bannerService.getActiveHeroBanners();

      res.json({
        success: true,
        data: banners
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create banner (admin)
  async createBanner(req: Request, res: Response) {
    try {
      const { title, subtitle, description, image_url, link_url, button_text, position, sort_order, start_date, end_date } = req.body;

      if (!title || !image_url) {
        return res.status(400).json({
          success: false,
          error: '제목과 이미지 URL은 필수입니다.'
        });
      }

      const banner = await bannerService.createBanner({
        title,
        subtitle,
        description,
        image_url,
        link_url,
        button_text,
        position,
        sort_order,
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined
      });

      res.status(201).json({
        success: true,
        data: banner
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update banner (admin)
  async updateBanner(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = { ...req.body };

      // Convert date strings to Date objects
      if (data.start_date) data.start_date = new Date(data.start_date);
      if (data.end_date) data.end_date = new Date(data.end_date);

      const banner = await bannerService.updateBanner(id, data);

      res.json({
        success: true,
        data: banner
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

  // Delete banner (admin)
  async deleteBanner(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await bannerService.deleteBanner(id);

      res.json({
        success: true,
        message: '배너가 삭제되었습니다.'
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
}

export const bannerController = new BannerController();
