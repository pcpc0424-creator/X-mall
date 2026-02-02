import { Router } from 'express';
import { payringController } from '../controllers/payring.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// 수기결제 요청 (로그인 필요)
router.post('/payment', authenticateUser, (req, res) => payringController.processPayment(req, res));

// 결제 콜백 (페이링에서 호출 - 인증 불필요)
router.post('/callback', (req, res) => payringController.paymentCallback(req, res));

// 결제 상태 조회 (로그인 필요)
router.get('/status/:order_id', authenticateUser, (req, res) => payringController.getPaymentStatus(req, res));

// 결제 취소 (로그인 필요)
router.post('/cancel/:order_id', authenticateUser, (req, res) => payringController.cancelPayment(req, res));

export default router;
