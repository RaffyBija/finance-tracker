import { Router } from 'express';
import {
  register, login, getMe,
  verifyEmail, requestPasswordReset, resetPassword,
  updateProfile, changePassword, deleteAccount,
  verifyEmailChange
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

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

router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.delete('/account', authenticate, deleteAccount);

export default router;