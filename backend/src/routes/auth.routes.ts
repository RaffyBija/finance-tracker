import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - Registrazione
router.post('/register', register);

// POST /api/auth/login - Login
router.post('/login', login);

// GET /api/auth/me - Info utente autenticato
router.get('/me', authenticate, getMe);

export default router;