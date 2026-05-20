import { Router } from 'express';
import {
  getRecurringTransactions,
  getRecurringTransaction,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
  getDueRecurring,
  executeRecurring,
} from '../controllers/recurring.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/due', getDueRecurring);
router.post('/execute', executeRecurring);
router.get('/', getRecurringTransactions);
router.get('/:id', getRecurringTransaction);
router.post('/', createRecurringTransaction);
router.put('/:id', updateRecurringTransaction);
router.delete('/:id', deleteRecurringTransaction);
router.patch('/:id/toggle', toggleRecurringTransaction);

export default router;