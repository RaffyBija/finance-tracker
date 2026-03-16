import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload } from '../types';

// ✅ Il server non parte se manca JWT_SECRET (vedi server.ts),
//    quindi qui possiamo usare l'asserzione non-null con sicurezza
const JWT_SECRET = process.env.JWT_SECRET!;

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token mancante o non valido' });
    }

    const token = authHeader.substring(7);

    // ✅ Nessun fallback: usa sempre la variabile d'ambiente
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token scaduto' });
    }
    return res.status(401).json({ error: 'Token non valido' });
  }
};