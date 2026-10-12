import { Router } from 'express';
import {
  register, login, getMe,
  verifyEmail, requestPasswordReset, resetPassword,
  updateProfile, changePassword, deleteAccount,
  verifyEmailChange, completeTour
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { emailChangeLimiter, passwordCheckLimiter, perRecipientEmailLimiter } from '../middleware/rateLimiters';

const router = Router();

//Registrazione
router.post('/register', perRecipientEmailLimiter("Troppe richieste per questo indirizzo email, riprova tra un'ora."), register);

//Login
router.post('/login', login);

//Info utente autenticato
router.get('/me', authenticate, getMe);

router.post('/verify-email', verifyEmail);
router.post('/request-password-reset', perRecipientEmailLimiter("Troppe richieste per questo indirizzo email, riprova tra un'ora. Se hai già richiesto il link, controlla la posta (anche lo spam): l'ultimo ricevuto è valido."), requestPasswordReset);
router.post('/verify-email-change', verifyEmailChange);
router.post('/reset-password', resetPassword);

router.put('/profile', authenticate, emailChangeLimiter, updateProfile);
router.put('/change-password', authenticate, passwordCheckLimiter, changePassword);
router.delete('/account', authenticate, passwordCheckLimiter, deleteAccount);
router.post('/tour-complete', authenticate, completeTour);

export default router;