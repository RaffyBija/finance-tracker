import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { perRecipientEmailLimiter } from '../../middleware/rateLimiters';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Due route con due istanze: i contatori devono restare separati.
  app.post('/register', perRecipientEmailLimiter('limite registrazione'), (_req, res) => { res.json({ ok: true }); });
  app.post('/reset', perRecipientEmailLimiter("Troppe richieste per questo indirizzo email, riprova tra un'ora."), (_req, res) => { res.json({ ok: true }); });
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });

const post = (path: string, body: object) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('perRecipientEmailLimiter', () => {
  it('dopo 5 richieste per lo stesso indirizzo risponde 429 (maiuscole e spazi non aggirano)', async () => {
    const variants = ['a@x.it', ' A@x.it', 'a@X.IT ', 'A@x.it', 'a@x.it'];
    for (const email of variants) expect((await post('/reset', { email })).status).toBe(200);
    const res = await post('/reset', { email: 'a@x.it' });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Troppe richieste per questo indirizzo email, riprova tra un'ora." });
  });

  it('il limite è per indirizzo: un altro destinatario non è toccato', async () => {
    for (let i = 0; i < 6; i++) await post('/reset', { email: 'bloccato@x.it' });
    expect((await post('/reset', { email: 'bloccato@x.it' })).status).toBe(429);
    expect((await post('/reset', { email: 'libero@x.it' })).status).toBe(200);
  });

  it('registrazione e reset hanno contatori separati', async () => {
    for (let i = 0; i < 6; i++) await post('/register', { email: 'sep@x.it' });
    expect((await post('/register', { email: 'sep@x.it' })).status).toBe(429);
    expect((await post('/reset', { email: 'sep@x.it' })).status).toBe(200);
  });

  it('ogni route usa il proprio messaggio', async () => {
    for (let i = 0; i < 6; i++) await post('/register', { email: 'msg@x.it' });
    expect(await (await post('/register', { email: 'msg@x.it' })).json()).toEqual({ error: 'limite registrazione' });
  });

  it('senza body (nessun content-type) non conta e non va in errore', async () => {
    const res = await fetch(`${base}/reset`, { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('senza email stringa non conta e lascia decidere al controller', async () => {
    for (let i = 0; i < 12; i++) {
      expect((await post('/reset', {})).status).toBe(200);
      expect((await post('/reset', { email: { not: '' } })).status).toBe(200);
      expect((await post('/reset', { email: 42 })).status).toBe(200);
    }
  });
});
