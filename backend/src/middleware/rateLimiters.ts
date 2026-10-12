import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';

// Cambio email dal profilo: ogni richiesta valida invia una mail (quota Resend) verso un
// indirizzo scelto dall'utente. Il limite globale (200/15 min) lascerebbe mandare molte mail,
// quindi qui si conta SOLO chi chiede un indirizzo diverso da quello attuale: salvare il nome
// (il frontend rimanda comunque l'email invariata) o altre preferenze non consuma il limite.
// Chiave = utente (il percorso è dietro `authenticate`). Conta anche i tentativi respinti
// (409 "già in uso"), così limita pure il sondaggio di email registrate.
export const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as AuthRequest).userId ?? 'anon',
  skip: async (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    if (typeof email !== 'string' || !email.trim()) return true;
    const userId = (req as AuthRequest).userId;
    if (!userId) return true;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return !user || user.email.toLowerCase() === email.trim().toLowerCase();
  },
  message: { error: 'Troppe richieste di cambio email, riprova tra un\'ora.' },
});

// Cambio password: la route verifica la password attuale, quindi con un token rubato si potrebbe
// indovinarla a ripetizione (limite globale: 200 / 15 min). Qui si contano SOLO i tentativi con
// password attuale errata (401): le richieste riuscite e gli errori di validazione (400) non
// consumano il limite. Chiave = utente.
export const passwordCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => (req as AuthRequest).userId ?? 'anon',
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  message: { error: 'Troppi tentativi con la password attuale, riprova tra 15 minuti.' },
});
