import { Router } from 'express';
import multer from 'multer';
import { authController } from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';
import { pointController } from '../controllers/point.controller';
import { rpayController } from '../controllers/rpay.controller';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { orderController } from '../controllers/order.controller';
import { productController } from '../controllers/product.controller';
import { settingsController } from '../controllers/settings.controller';
import { categoryController } from '../controllers/category.controller';
import { bannerController } from '../controllers/banner.controller';
import { eventController } from '../controllers/event.controller';
import { announcementController } from '../controllers/announcement.controller';
import { payringController } from '../controllers/payring.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Multer configuration for file uploads (memory storage for Excel parsing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream'
    ];
    const allowedExtensions = ['.xls', '.xlsx'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('엑셀 파일(.xls, .xlsx)만 업로드 가능합니다.'));
    }
  }
});

// Image upload configuration
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../../uploads/products');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${uuidv4()}${ext}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다.'));
    }
  }
});

// Auth
router.post('/auth/login', (req, res) => authController.adminLogin(req, res));

// Users (protected)
router.get('/users', authenticateAdmin, (req, res) => userController.getUsers(req, res));
router.get('/users/:id', authenticateAdmin, (req, res) => userController.getUserById(req, res));
router.post('/users', authenticateAdmin, (req, res) => userController.createUser(req, res));
router.post('/users/bulk-upload', authenticateAdmin, upload.single('file'), (req, res) => userController.bulkUpload(req, res));
router.put('/users/:id/grade', authenticateAdmin, (req, res) => userController.updateGrade(req, res));
router.put('/users/:id/password', authenticateAdmin, (req, res) => userController.adminResetPassword(req, res));
router.delete('/users/:id', authenticateAdmin, (req, res) => userController.deactivateUser(req, res));

// Dealers (protected) - for referrer selection
router.get('/dealers', authenticateAdmin, (req, res) => userController.getDealers(req, res));

// Genealogy (protected) - view a dealer's downline
router.get('/users/:dealerId/genealogy', authenticateAdmin, (req, res) => userController.getGenealogyByDealerId(req, res));

// Points (protected)
router.post('/points/grant', authenticateAdmin, (req, res) => pointController.adminGrantPoints(req, res));
router.post('/points/bulk-grant', authenticateAdmin, upload.single('file'), (req, res) => pointController.bulkGrant(req, res));
router.get('/points/pending', authenticateAdmin, (req, res) => pointController.getPendingPPoints(req, res));
router.get('/points/transactions', authenticateAdmin, (req, res) => pointController.getAllTransactions(req, res));

// R-pay (protected)
router.post('/rpay/deposit', authenticateAdmin, (req, res) => rpayController.adminDeposit(req, res));

// Withdrawals (protected)
router.get('/withdrawals', authenticateAdmin, (req, res) => withdrawalController.getAllWithdrawals(req, res));
router.put('/withdrawals/:id/approve', authenticateAdmin, (req, res) => withdrawalController.approveWithdrawal(req, res));
router.put('/withdrawals/:id/reject', authenticateAdmin, (req, res) => withdrawalController.rejectWithdrawal(req, res));
router.put('/withdrawals/:id/complete', authenticateAdmin, (req, res) => withdrawalController.completeWithdrawal(req, res));

// Orders (protected)
router.get('/orders', authenticateAdmin, (req, res) => orderController.getAllOrders(req, res));
router.get('/orders/:id', authenticateAdmin, (req, res) => orderController.adminGetOrderById(req, res));
router.put('/orders/:id/status', authenticateAdmin, (req, res) => orderController.updateOrderStatus(req, res));
router.put('/orders/:id/invoice', authenticateAdmin, (req, res) => orderController.updateInvoiceNumber(req, res));

// Image Upload (protected)
router.post('/upload/image', authenticateAdmin, imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '이미지 파일을 선택해주세요.' });
    }
    const imageUrl = `/X-mall/uploads/products/${req.file.filename}`;
    res.json({ success: true, data: { url: imageUrl, filename: req.file.filename } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Products (protected)
router.get('/products', authenticateAdmin, (req, res) => productController.adminGetProducts(req, res));
router.get('/products/singles', authenticateAdmin, (req, res) => productController.getSingleProducts(req, res));
router.post('/products', authenticateAdmin, (req, res) => productController.createProduct(req, res));
router.post('/products/bulk-upload', authenticateAdmin, upload.single('file'), (req, res) => productController.bulkUpload(req, res));
router.get('/products/:id', authenticateAdmin, (req, res) => productController.getProductWithItems(req, res));
router.put('/products/:id', authenticateAdmin, (req, res) => productController.updateProduct(req, res));
router.put('/products/:id/stock', authenticateAdmin, (req, res) => productController.updateStock(req, res));
router.delete('/products/:id', authenticateAdmin, (req, res) => productController.deleteProduct(req, res));

// Package Items (protected)
router.get('/products/:id/items', authenticateAdmin, (req, res) => productController.getPackageItems(req, res));
router.put('/products/:id/items', authenticateAdmin, (req, res) => productController.setPackageItems(req, res));
router.post('/products/:id/items', authenticateAdmin, (req, res) => productController.addPackageItem(req, res));
router.delete('/products/:id/items/:itemId', authenticateAdmin, (req, res) => productController.removePackageItem(req, res));

// Dashboard
router.get('/dashboard/stats', authenticateAdmin, (req, res) => settingsController.getDashboardStats(req, res));

// Settings (protected)
router.get('/settings/exchange-rate', authenticateAdmin, (req, res) => settingsController.getCurrentExchangeRate(req, res));
router.post('/settings/exchange-rate', authenticateAdmin, (req, res) => settingsController.setExchangeRate(req, res));
router.get('/settings/exchange-rate/history', authenticateAdmin, (req, res) => settingsController.getExchangeRateHistory(req, res));
router.get('/settings/holidays', authenticateAdmin, (req, res) => settingsController.getHolidays(req, res));
router.post('/settings/holidays', authenticateAdmin, (req, res) => settingsController.addHoliday(req, res));
router.delete('/settings/holidays/:id', authenticateAdmin, (req, res) => settingsController.deleteHoliday(req, res));

// Categories (protected)
router.get('/categories', authenticateAdmin, (req, res) => categoryController.getCategories(req, res));
router.get('/categories/:id', authenticateAdmin, (req, res) => categoryController.getCategoryById(req, res));
router.get('/categories/:id/products', authenticateAdmin, (req, res) => categoryController.getCategoryWithProductCount(req, res));
router.get('/categories/:id/subcategories', authenticateAdmin, (req, res) => categoryController.getSubcategories(req, res));
router.post('/categories', authenticateAdmin, (req, res) => categoryController.createCategory(req, res));
router.put('/categories/:id', authenticateAdmin, (req, res) => categoryController.updateCategory(req, res));
router.delete('/categories/:id', authenticateAdmin, (req, res) => categoryController.deleteCategory(req, res));

// Banners (protected)
router.get('/banners', authenticateAdmin, (req, res) => bannerController.getBanners(req, res));
router.get('/banners/:id', authenticateAdmin, (req, res) => bannerController.getBannerById(req, res));
router.post('/banners', authenticateAdmin, (req, res) => bannerController.createBanner(req, res));
router.put('/banners/:id', authenticateAdmin, (req, res) => bannerController.updateBanner(req, res));
router.delete('/banners/:id', authenticateAdmin, (req, res) => bannerController.deleteBanner(req, res));

// Events (protected)
router.get('/events', authenticateAdmin, (req, res) => eventController.getEvents(req, res));
router.get('/events/stats', authenticateAdmin, (req, res) => eventController.getEventStats(req, res));
router.get('/events/:id', authenticateAdmin, (req, res) => eventController.getEventById(req, res));
router.post('/events', authenticateAdmin, (req, res) => eventController.createEvent(req, res));
router.put('/events/:id', authenticateAdmin, (req, res) => eventController.updateEvent(req, res));
router.delete('/events/:id', authenticateAdmin, (req, res) => eventController.deleteEvent(req, res));

// Announcements (protected)
router.get('/announcements', authenticateAdmin, (req, res) => announcementController.adminGetAnnouncements(req, res));
router.get('/announcements/:id', authenticateAdmin, (req, res) => announcementController.adminGetAnnouncementById(req, res));
router.post('/announcements', authenticateAdmin, (req, res) => announcementController.createAnnouncement(req, res));
router.put('/announcements/:id', authenticateAdmin, (req, res) => announcementController.updateAnnouncement(req, res));
router.delete('/announcements/:id', authenticateAdmin, (req, res) => announcementController.deleteAnnouncement(req, res));

// Payments (protected) - 카드 결제 내역
router.get('/payments', authenticateAdmin, (req, res) => payringController.getPaymentList(req, res));
router.get('/payments/:id', authenticateAdmin, (req, res) => payringController.getPaymentDetail(req, res));
router.post('/payments/:id/cancel', authenticateAdmin, (req, res) => payringController.adminCancelPayment(req, res));

export default router;
