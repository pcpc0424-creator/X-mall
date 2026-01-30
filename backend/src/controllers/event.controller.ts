import { Request, Response } from 'express';
import { eventService } from '../services/event.service';

export class EventController {
  // Get all events
  async getEvents(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const eventType = req.query.eventType as string | undefined;

      const events = await eventService.getEvents({ activeOnly, eventType });

      res.json({
        success: true,
        data: events
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get single event
  async getEventById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const event = await eventService.getEventById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          error: '이벤트를 찾을 수 없습니다.'
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get active events (public)
  async getActiveEvents(req: Request, res: Response) {
    try {
      const events = await eventService.getActiveEvents();

      res.json({
        success: true,
        data: events
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get upcoming events (public)
  async getUpcomingEvents(req: Request, res: Response) {
    try {
      const events = await eventService.getUpcomingEvents();

      res.json({
        success: true,
        data: events
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get event statistics (admin)
  async getEventStats(req: Request, res: Response) {
    try {
      const stats = await eventService.getEventStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create event (admin)
  async createEvent(req: Request, res: Response) {
    try {
      const { title, description, content, image_url, banner_url, event_type, discount_type, discount_value, coupon_code, start_date, end_date } = req.body;

      if (!title || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          error: '제목, 시작일, 종료일은 필수입니다.'
        });
      }

      const event = await eventService.createEvent({
        title,
        description,
        content,
        image_url,
        banner_url,
        event_type,
        discount_type,
        discount_value,
        coupon_code,
        start_date: new Date(start_date),
        end_date: new Date(end_date)
      });

      res.status(201).json({
        success: true,
        data: event
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Update event (admin)
  async updateEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = { ...req.body };

      // Convert date strings to Date objects
      if (data.start_date) data.start_date = new Date(data.start_date);
      if (data.end_date) data.end_date = new Date(data.end_date);

      const event = await eventService.updateEvent(id, data);

      res.json({
        success: true,
        data: event
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

  // Delete event (admin)
  async deleteEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await eventService.deleteEvent(id);

      res.json({
        success: true,
        message: '이벤트가 삭제되었습니다.'
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

export const eventController = new EventController();
