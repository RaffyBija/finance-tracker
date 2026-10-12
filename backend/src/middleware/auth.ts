import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthRequest, JWTPayload } from '../types';

// ✅ Il server non parte se manca JWT_SECRET (vedi server.ts),
//    quindi qui possiamo usare l'asserzione non-null con sicurezza
const JWT_SECRET = process.env.JWT_SECRET!;

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  let decoded: JWTPayload;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token mancante o non valido' });
    }

    const token = authHeader.substring(7);

    // ✅ Nessun fallback: usa sempre la variabile d'ambiente
    decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token scaduto' });
    }
    return res.status(401).json({ error: 'Token non valido' });
  }

  // Revoca: il token vale solo se l'utente esiste ancora (account cancellato) e la sua versione
  // delle sessioni coincide con quella del token (cambio o reset password la incrementano).
  // I token emessi prima di questa funzione non hanno `tv`: valgono come versione 0.
  // Un errore di DB NON è un 401 (il frontend farebbe il logout): risponde 500.
  // ponytail: una lettura per richiesta autenticata (chiave primaria); una cache breve per
  // utente se la latenza del DB diventasse un problema.
  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { tokenVersion: true } });
    if (!user || (decoded.tv ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Sessione non più valida, accedi di nuovo' });
    }
  } catch (error) {
    console.error('Authenticate: verifica sessione fallita:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Errore del server' });
  }

  req.userId = decoded.userId;
  req.tokenExp = decoded.exp;
  next();
};
