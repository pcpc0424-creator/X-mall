import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';
import { pointController } from '../controllers/point.controller';
import { rpayController } from '../controllers/rpay.controller';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { orderController } from '../controllers/order.controller';
import { productController } from '../controllers/product.controller';
import { settingsController } from '../controllers/settings.controller';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Auth
router.post('/auth/login', (req, res) => authController.adminLogin(req, res));

// Users (protected)
router.get('/users', authenticateAdmin, (req, res) => userController.getUsers(req, res));
router.get('/users/:id', authenticateAdmin, (req, res) => userController.getUserById(req, res));
router.post('/users', authenticateAdmin, (req, res) => userController.createUser(req, res));
router.put('/users/:id/grade', authenticateAdmin, (req, res) => userController.updateGrade(req, res));
router.delete('/users/:id', authenticateAdmin, (req, res) => userController.deactivateUser(req, res));

// Points (protected)
router.post('/points/grant', authenticateAdmin, (req, res) => pointController.adminGrantPoints(req, res));
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

// Products (protected)
router.get('/products', authenticateAdmin, (req, res) => productController.adminGetProducts(req, res));
router.post('/products', authenticateAdmin, (req, res) => productController.createProduct(req, res));
router.put('/products/:id', authenticateAdmin, (req, res) => productController.updateProduct(req, res));
router.put('/products/:id/stock', authenticateAdmin, (req, res) => productController.updateStock(req, res));
router.delete('/products/:id', authenticateAdmin, (req, res) => productController.deleteProduct(req, res));

// Dashboard
router.get('/dashboard/stats', authenticateAdmin, (req, res) => settingsController.getDashboardStats(req, res));

// Settings (protected)
router.get('/settings/exchange-rate', authenticateAdmin, (req, res) => settingsController.getCurrentExchangeRate(req, res));
router.post('/settings/exchange-rate', authenticateAdmin, (req, res) => settingsController.setExchangeRate(req, res));
router.get('/settings/exchange-rate/history', authenticateAdmin, (req, res) => settingsController.getExchangeRateHistory(req, res));
router.get('/settings/holidays', authenticateAdmin, (req, res) => settingsController.getHolidays(req, res));
router.post('/settings/holidays', authenticateAdmin, (req, res) => settingsController.addHoliday(req, res));
router.delete('/settings/holidays/:id', authenticateAdmin, (req, res) => settingsController.deleteHoliday(req, res));

export default router;
