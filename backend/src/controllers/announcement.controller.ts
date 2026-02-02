import { Request, Response } from 'express';
import { announcementService } from '../services/announcement.service';
import { AdminAuthRequest } from '../types';

export class AnnouncementController {
  // Public: Get announcements
  async getAnnouncements(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;

      const result = await announcementService.getAnnouncements({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
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

  // Public: Get announcement by ID
  async getAnnouncementById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const announcement = await announcementService.getAnnouncementById(id);

      if (!announcement || !announcement.is_active) {
        return res.status(404).json({
          success: false,
          error: '공지사항을 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: announcement
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Get all announcements (including inactive)
  async adminGetAnnouncements(req: AdminAuthRequest, res: Response) {
    try {
      const { page, limit } = req.query;

      const result = await announcementService.getAnnouncements({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
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

  // Admin: Get announcement by ID
  async adminGetAnnouncementById(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const announcement = await announcementService.getAnnouncementById(id);

      if (!announcement) {
        return res.status(404).json({
          success: false,
          error: '공지사항을 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: announcement
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Create announcement
  async createAnnouncement(req: AdminAuthRequest, res: Response) {
    try {
      const { title, content, is_important } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          error: '제목과 내용은 필수입니다.'
        });
      }

      const announcement = await announcementService.createAnnouncement({
        title,
        content,
        is_important
      });

      res.status(201).json({
        success: true,
        data: announcement,
        message: '공지사항이 등록되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Update announcement
  async updateAnnouncement(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { title, content, is_important, is_active } = req.body;

      const announcement = await announcementService.updateAnnouncement(id, {
        title,
        content,
        is_important,
        is_active
      });

      res.json({
        success: true,
        data: announcement,
        message: '공지사항이 수정되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Admin: Delete announcement
  async deleteAnnouncement(req: AdminAuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await announcementService.deleteAnnouncement(id);

      res.json({
        success: true,
        message: '공지사항이 삭제되었습니다.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const announcementController = new AnnouncementController();
