import type { Request, Response, NextFunction } from 'express';

// Errori del client generati da Express/body-parser (JSON malformato, body troppo grande, ecc.)
// hanno `status` 4xx: vanno restituiti come 4xx, non come 500, e senza stack nei log.
// Gli altri errori restano 500 con messaggio generico in produzione.
export function errorHandler(err: Error & { status?: number; statusCode?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status ?? err.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const error = status === 413 ? 'Richiesta troppo grande' : 'Richiesta non valida';
    return res.status(status).json({ error });
  }
  console.error(err.stack);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Errore del server' : err.message });
}
