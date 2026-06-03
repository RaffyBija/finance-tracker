import { Router } from 'express';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  setDefaultAccount,
  settleAccount,
  closeBillingCycle,
  getBillingCycles,
} from '../controllers/account.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAccounts);
router.get('/:id', getAccount);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);
router.patch('/:id/default', setDefaultAccount);
router.post('/:id/settle', settleAccount);
router.post('/:id/close-billing-cycle', closeBillingCycle);
router.get('/:id/cycles', getBillingCycles);

export default router;
