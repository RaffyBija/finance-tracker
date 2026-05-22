import { Router } from 'express';
import { getForecast } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/forecast', getForecast);

export default router;
