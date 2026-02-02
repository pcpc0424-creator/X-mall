import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { bannerController } from '../controllers/banner.controller';
import { eventController } from '../controllers/event.controller';
import { announcementController } from '../controllers/announcement.controller';

const router = Router();

// Public Category routes
router.get('/categories', (req, res) => categoryController.getCategories(req, res));
router.get('/categories/:id', (req, res) => categoryController.getCategoryById(req, res));
router.get('/categories/:id/subcategories', (req, res) => categoryController.getSubcategories(req, res));

// Public Banner routes
router.get('/banners', (req, res) => bannerController.getBanners(req, res));
router.get('/banners/hero', (req, res) => bannerController.getActiveHeroBanners(req, res));

// Public Event routes
router.get('/events', (req, res) => eventController.getEvents(req, res));
router.get('/events/active', (req, res) => eventController.getActiveEvents(req, res));
router.get('/events/upcoming', (req, res) => eventController.getUpcomingEvents(req, res));
router.get('/events/:id', (req, res) => eventController.getEventById(req, res));

// Public Announcement routes
router.get('/announcements', (req, res) => announcementController.getAnnouncements(req, res));
router.get('/announcements/:id', (req, res) => announcementController.getAnnouncementById(req, res));

export default router;
