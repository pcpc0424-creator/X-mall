import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', (req, res) => productController.getProducts(req, res));
router.get('/:id', (req, res) => productController.getProductById(req, res));

// Dealer routes
router.get('/dealer/list', authenticateUser, (req, res) => productController.getDealerProducts(req, res));

export default router;
