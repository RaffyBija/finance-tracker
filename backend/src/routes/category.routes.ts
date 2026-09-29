import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  archiveCategory,
  restoreCategory,
  getCategoryUsage,
  mergeCategories,
  getOrganizePreview,
  applyOrganize,
} from '../controllers/category.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Tutte le routes richiedono autenticazione
router.use(authenticate);

// GET /api/categories - Ottieni tutte le categorie
router.get('/', getCategories);

// Organizza categorie (prima di /:id per non essere catturate come id)
router.get('/organize', getOrganizePreview);
router.post('/organize', applyOrganize);
router.post('/reorder', reorderCategories);

// GET /api/categories/:id - Ottieni una categoria
router.get('/:id', getCategory);
router.get('/:id/usage', getCategoryUsage);
router.post('/:id/archive', archiveCategory);
router.post('/:id/restore', restoreCategory);
router.post('/:id/merge', mergeCategories);

// POST /api/categories - Crea una categoria
router.post('/', createCategory);

// PUT /api/categories/:id - Aggiorna una categoria
router.put('/:id', updateCategory);

// DELETE /api/categories/:id - Elimina una categoria
router.delete('/:id', deleteCategory);

export default router;