import { Router } from 'express';
import {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Tutte le routes richiedono autenticazione
router.use(authenticate);

// GET /api/transactions - Ottieni tutte le transazioni
router.get('/', getTransactions);

// GET /api/transactions/:id - Ottieni una transazione
router.get('/:id', getTransaction);

// POST /api/transactions - Crea una transazione
router.post('/', createTransaction);

// PUT /api/transactions/:id - Aggiorna una transazione
router.put('/:id', updateTransaction);

// DELETE /api/transactions/:id - Elimina una transazione
router.delete('/:id', deleteTransaction);

export default router;