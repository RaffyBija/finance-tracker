import { Router } from 'express';
import { register, login, getMe,verifyEmail,requestPasswordReset,resetPassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - Registrazione
router.post('/register', register);

// POST /api/auth/login - Login
router.post('/login', login);

// GET /api/auth/me - Info utente autenticato
router.get('/me', authenticate, getMe);

router.post('/verify-email', verifyEmail);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;