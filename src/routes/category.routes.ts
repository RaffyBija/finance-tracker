import { Router } from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Tutte le routes richiedono autenticazione
router.use(authenticate);

// GET /api/categories - Ottieni tutte le categorie
router.get('/', getCategories);

// GET /api/categories/:id - Ottieni una categoria
router.get('/:id', getCategory);

// POST /api/categories - Crea una categoria
router.post('/', createCategory);

// PUT /api/categories/:id - Aggiorna una categoria
router.put('/:id', updateCategory);

// DELETE /api/categories/:id - Elimina una categoria
router.delete('/:id', deleteCategory);

export default router;