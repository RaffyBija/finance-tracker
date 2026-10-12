import { Router } from 'express';
import {
  register, login, getMe,
  verifyEmail, requestPasswordReset, resetPassword,
  updateProfile, changePassword, deleteAccount,
  verifyEmailChange, completeTour
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { emailChangeLimiter, passwordCheckLimiter } from '../middleware/rateLimiters';

const router = Router();

//Registrazione
router.post('/register', register);

//Login
router.post('/login', login);

//Info utente autenticato
router.get('/me', authenticate, getMe);

router.post('/verify-email', verifyEmail);
router.post('/request-password-reset', requestPasswordReset);
router.post('/verify-email-change', verifyEmailChange);
router.post('/reset-password', resetPassword);

router.put('/profile', authenticate, emailChangeLimiter, updateProfile);
router.put('/change-password', authenticate, passwordCheckLimiter, changePassword);
router.delete('/account', authenticate, deleteAccount);
router.post('/tour-complete', authenticate, completeTour);

export default router;