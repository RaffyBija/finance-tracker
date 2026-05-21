import { Router } from 'express';
import {
  getPlannedTransactions,
  getPlannedTransaction,
  getPlannedDue,
  createPlannedTransaction,
  updatePlannedTransaction,
  deletePlannedTransaction,
  markAsPaid,
} from '../controllers/planned.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getPlannedTransactions);
router.get('/due', getPlannedDue);
router.get('/:id', getPlannedTransaction);
router.post('/', createPlannedTransaction);
router.put('/:id', updatePlannedTransaction);
router.delete('/:id', deletePlannedTransaction);
router.patch('/:id/mark-paid', markAsPaid);

export default router;