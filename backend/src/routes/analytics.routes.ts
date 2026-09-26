import { Router } from 'express';
import { getForecast, getPayPeriod, getSpendingAnalysis, getNetWorthNow } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/forecast', getForecast);
router.get('/pay-period', getPayPeriod);
router.get('/spending', getSpendingAnalysis);
router.get('/net-worth', getNetWorthNow);

export default router;
