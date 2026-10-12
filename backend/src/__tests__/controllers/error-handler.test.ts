import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { errorHandler } from '../../middleware/errorHandler';

let server: Server;
let base: string;
const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.post('/echo', (req, res) => { res.json(req.body); });
  app.get('/boom', () => { throw new Error('segreto interno'); });
  app.use(errorHandler);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });

describe('errorHandler', () => {
  it('JSON malformato → 400 (non 500), senza stack nei log e senza dettagli interni', async () => {
    errSpy.mockClear();
    const res = await fetch(`${base}/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Richiesta non valida' });
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('body oltre il limite → 413', async () => {
    const res = await fetch(`${base}/echo`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(5000) }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Richiesta troppo grande' });
  });

  it('errore del server → 500 e lo stack finisce nei log', async () => {
    errSpy.mockClear();
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let res: Response;
    try { res = await fetch(`${base}/boom`); } finally { process.env.NODE_ENV = prev; }
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Errore del server' }); // niente messaggio interno
    expect(errSpy).toHaveBeenCalled();
  });
});
