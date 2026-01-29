import { Router } from 'express';
import {
  getSummary,
  getCategoryStats,
  getRecentTransactions,
  getMonthlyTrend,
  getProjectedBalance,
} from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Tutte le routes richiedono autenticazione
router.use(authenticate);

// GET /api/dashboard/summary - Sommario finanziario
router.get('/summary', getSummary);

// GET /api/dashboard/category-stats - Statistiche per categoria
router.get('/category-stats', getCategoryStats);

// GET /api/dashboard/recent - Transazioni recenti
router.get('/recent', getRecentTransactions);

// GET /api/dashboard/monthly-trend - Trend mensile
router.get('/monthly-trend', getMonthlyTrend);

// GET /api/dashboard/projected-balance - Saldo previsto con spese ricorrenti
router.get('/projected-balance', getProjectedBalance);

export default router;