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

// Email transazionali (registrazione, reset password): oltre al limite per IP (`authLimiter`, 10 / 15
// min condiviso) serve un limite per DESTINATARIO, altrimenti da un solo IP si arriva a centinaia di
// mail al giorno (quota Resend, casella di una vittima). Chiave = email normalizzata. Conta ogni
// richiesta, esista o no l'account, così il 429 non rivela se un indirizzo è registrato.
// Una factory per route: i contatori di registrazione e reset restano separati.
// ponytail: la chiave è l'indirizzo esatto, quindi gli alias (`nome+1@gmail.com`, `n.ome@gmail.com`)
// la aggirano su /register (resta il limite per IP); contatore in memoria, azzerato a ogni riavvio.
// Un attaccante può tenere in 429 il reset di una vittima (5 richieste/ora): per questo il
// messaggio invita a controllare la posta, dove l'ultimo link inviato resta valido.
export const perRecipientEmailLimiter = (message: string) => rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => String((req.body as { email?: unknown }).email).trim().toLowerCase().slice(0, 254),
  skip: (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email !== 'string' || !email.trim();
  },
  message: { error: message },
});
