import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

vi.mock('../../utils/prisma', () => ({
  default: { user: { findUnique: vi.fn(async () => ({ email: 'attuale@example.com' })) } },
}));

import { emailChangeLimiter } from '../../middleware/rateLimiters';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Al posto di `authenticate`: l'utente arriva dall'header di test.
  app.use((req, _res, next) => { (req as any).userId = req.header('x-user'); next(); });
  app.put('/profile', emailChangeLimiter, (_req, res) => { res.json({ ok: true }); });
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });

const put = (user: string, body: object) =>
  fetch(`${base}/profile`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-user': user },
    body: JSON.stringify(body),
  });

describe('emailChangeLimiter', () => {
  it('non conta le richieste senza email o con l\'email invariata (anche se maiuscola)', async () => {
    for (let i = 0; i < 12; i++) {
      expect((await put('u-invariata', { name: 'Mario' })).status).toBe(200);
      expect((await put('u-invariata', { name: 'Mario', email: 'ATTUALE@example.com' })).status).toBe(200);
    }
  });

  it('dopo 5 richieste di un indirizzo diverso risponde 429 con messaggio in italiano', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await put('u-cambio', { email: `nuova${i}@example.com` })).status).toBe(200);
    }
    const res = await put('u-cambio', { email: 'nuova6@example.com' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Troppe richieste di cambio email, riprova tra un'ora." });
  });

  it('il limite è per utente: un altro utente non è toccato', async () => {
    for (let i = 0; i < 5; i++) await put('u-esaurito', { email: `x${i}@example.com` });
    expect((await put('u-esaurito', { email: 'y@example.com' })).status).toBe(429);
    expect((await put('u-altro', { email: 'z@example.com' })).status).toBe(200);
  });

  it('una richiesta senza email non viene bloccata nemmeno a limite esaurito', async () => {
    for (let i = 0; i < 6; i++) await put('u-misto', { email: `m${i}@example.com` });
    expect((await put('u-misto', { email: 'm9@example.com' })).status).toBe(429);
    expect((await put('u-misto', { name: 'Solo nome' })).status).toBe(200);
  });
});
