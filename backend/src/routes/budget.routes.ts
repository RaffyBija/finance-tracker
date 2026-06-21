import { Router } from 'express';
import {
  getBudgets,
  getBudget,
  getBudgetHistory,
  createBudget,
  updateBudget,
  deleteBudget,
} from '../controllers/budget.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getBudgets);
router.get('/:id/history', getBudgetHistory);
router.get('/:id', getBudget);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

export default router;