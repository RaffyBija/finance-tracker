import { Router } from 'express';
import {
  getInstallmentPlans,
  getInstallmentPlan,
  getInstallmentsDue,
  createInstallmentPlan,
  updateInstallmentPlan,
  deleteInstallmentPlan,
  payInstallments,
} from '../controllers/installment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getInstallmentPlans);
router.post('/', createInstallmentPlan);
router.post('/pay', payInstallments);
router.get('/due', getInstallmentsDue);
router.get('/:id', getInstallmentPlan);
router.put('/:id', updateInstallmentPlan);
router.delete('/:id', deleteInstallmentPlan);

export default router;
