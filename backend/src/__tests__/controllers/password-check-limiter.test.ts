import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { passwordCheckLimiter } from '../../middleware/rateLimiters';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Al posto di `authenticate`: l'utente arriva dall'header di test.
  app.use((req, _res, next) => { (req as any).userId = req.header('x-user'); next(); });
  // Al posto di changePassword: 400 validazione, 401 password errata, 200 ok.
  app.put('/change-password', passwordCheckLimiter, (req, res) => {
    if (req.body.invalid) return res.status(400).json({ error: 'validazione' });
    if (req.body.wrong) return res.status(401).json({ error: 'Password attuale non corretta' });
    res.json({ ok: true });
  });
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });

const put = (user: string, body: object) =>
  fetch(`${base}/change-password`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-user': user },
    body: JSON.stringify(body),
  });

describe('passwordCheckLimiter', () => {
  it('non conta le richieste riuscite né gli errori di validazione', async () => {
    for (let i = 0; i < 12; i++) {
      expect((await put('u-ok', {})).status).toBe(200);
      expect((await put('u-ok', { invalid: true })).status).toBe(400);
    }
  });

  it('dopo 5 password attuali errate risponde 429 con messaggio in italiano, anche con password giusta', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await put('u-errate', { wrong: true })).status).toBe(401);
    }
    const res = await put('u-errate', {});
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Troppi tentativi con la password attuale, riprova tra 15 minuti.' });
  });

  it('i tentativi riusciti non azzerano né consumano il contatore degli errori', async () => {
    for (let i = 0; i < 4; i++) await put('u-misto', { wrong: true });
    for (let i = 0; i < 6; i++) expect((await put('u-misto', {})).status).toBe(200);
    expect((await put('u-misto', { wrong: true })).status).toBe(401); // 5° errore
    expect((await put('u-misto', {})).status).toBe(429);
  });

  it('il limite è per utente', async () => {
    for (let i = 0; i < 5; i++) await put('u-bloccato', { wrong: true });
    expect((await put('u-bloccato', {})).status).toBe(429);
    expect((await put('u-libero', {})).status).toBe(200);
  });

  it('una raffica parallela di password errate: al più 5 arrivano al controller (401), le altre 429', async () => {
    const res = await Promise.all(Array.from({ length: 20 }, () => put('u-raffica', { wrong: true })));
    const status = res.map((r) => r.status);
    expect(status.filter((s) => s === 401).length).toBe(5);
    expect(status.filter((s) => s === 429).length).toBe(15);
  });
});
