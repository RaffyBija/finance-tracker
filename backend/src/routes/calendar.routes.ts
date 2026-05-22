import { Router } from 'express';
import { getCalendarEvents } from '../controllers/calendar.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/events', getCalendarEvents);

export default router;
