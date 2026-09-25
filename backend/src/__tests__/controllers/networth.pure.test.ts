import { describe, it, expect } from 'vitest';

// dashboard.controller importa il singleton prisma e utils/balance: li mockiamo
// perché questi test toccano solo la funzione pura di ricostruzione (nessun DB).
import { vi } from 'vitest';
vi.mock('../../utils/prisma', () => ({ default: {} }));

import { reconstructNetWorthSeries } from '../../controllers/dashboard.controller';

type Tx = Parameters<typeof reconstructNetWorthSeries>[1][number];

describe('reconstructNetWorthSeries', () => {
  it('emette esattamente `months` punti, in ordine cronologico', () => {
    const now = new Date(2026, 5, 15); // 15 giugno 2026
    const points = reconstructNetWorthSeries(1000, [], 6, now);
    expect(points.map((p) => p.month)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ]);
  });

  it('senza movimenti, il patrimonio è costante e pari al valore attuale', () => {
    const now = new Date(2026, 5, 15);
    const points = reconstructNetWorthSeries(1500.5, [], 4, now);
    expect(points.every((p) => p.netWorth === 1500.5)).toBe(true);
  });

  it('il punto corrente (ultimo) coincide sempre col patrimonio attuale', () => {
    const now = new Date(2026, 5, 15);
    const txns: Tx[] = [
      { date: new Date(2026, 3, 10), type: 'INCOME', amount: 500 },
      { date: new Date(2026, 5, 1), type: 'EXPENSE', amount: 200 },
    ];
    const points = reconstructNetWorthSeries(2000, txns, 6, now);
    expect(points[points.length - 1].netWorth).toBe(2000);
  });

  it('ricostruisce il passato sottraendo i movimenti avvenuti dopo il fine-mese', () => {
    const now = new Date(2026, 2, 15); // 15 marzo 2026
    // attuale = 1000. A marzo è entrato +300, a febbraio (entro il mese) -100.
    const txns: Tx[] = [
      { date: new Date(2026, 1, 20), type: 'EXPENSE', amount: 100 }, // 20 feb
      { date: new Date(2026, 2, 5), type: 'INCOME', amount: 300 },   // 5 mar
    ];
    const points = reconstructNetWorthSeries(1000, txns, 3, now);
    // gen: fine gennaio = 1000 - (-100 + 300) = 800
    // feb: fine febbraio = 1000 - (300) = 700  (la spesa del 20 feb è prima del fine-mese)
    // mar (corrente) = 1000
    expect(points.map((p) => p.netWorth)).toEqual([800, 700, 1000]);
  });

  it('gestisce importi come stringa (Decimal serializzato)', () => {
    const now = new Date(2026, 1, 15);
    const txns: Tx[] = [
      { date: new Date(2026, 1, 5), type: 'INCOME', amount: '250.50' },
    ];
    const points = reconstructNetWorthSeries(1250.5, txns, 2, now);
    // gen: 1250.50 - 250.50 = 1000 ; feb (corrente) = 1250.50
    expect(points.map((p) => p.netWorth)).toEqual([1000, 1250.5]);
  });

  it('esclude le transazioni datate nel futuro dal punto "oggi" e dai mesi passati', () => {
    const now = new Date(2026, 5, 19); // 19 giugno 2026
    // allTimeBalance = 1700 (1000 reale a fine maggio + 200 a giugno + 500 datato a luglio).
    const txns: Tx[] = [
      { date: new Date(2026, 5, 10), type: 'INCOME', amount: 200 },  // 10 giu (reale)
      { date: new Date(2026, 6, 15), type: 'INCOME', amount: 500 },  // 15 lug (futuro)
    ];
    const points = reconstructNetWorthSeries(1700, txns, 2, now);
    // maggio (fine mese): 1700 - (200 + 500) = 1000 ; giugno (oggi): 1700 - 500 = 1200
    // La riga di luglio NON gonfia né il passato né il presente.
    expect(points.map((p) => p.netWorth)).toEqual([1000, 1200]);
  });

  it('attraversa correttamente il cambio d’anno', () => {
    const now = new Date(2026, 0, 10); // 10 gen 2026
    const points = reconstructNetWorthSeries(500, [], 3, now);
    expect(points.map((p) => p.month)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  // ── Ancore openingBalance/createdAt (fix "linea piatta fasulla", bug_012) ──────
  describe('con ancore createdAt/openingBalance', () => {
    it('azzera i mesi precedenti alla creazione del conto invece di mostrare openingBalance', () => {
      const now = new Date(2026, 5, 15); // 15 giu 2026
      // Conto creato il 20 aprile 2026 con openingBalance 1000, nessun movimento.
      // Saldo attuale = 1000. La vista a 6 mesi NON deve mostrare 1000 a gen/feb/mar.
      const anchors = [{ openingBalance: 1000, createdAt: new Date(2026, 3, 20) }];
      const points = reconstructNetWorthSeries(1000, [], 6, now, anchors);
      // gen, feb, mar (fine mese < createdAt) = 0; apr/mag/giu = 1000
      expect(points.map((p) => p.netWorth)).toEqual([0, 0, 0, 1000, 1000, 1000]);
    });

    it('per-conto: lo scalino appare al mese di creazione e i movimenti successivi muovono la serie', () => {
      const now = new Date(2026, 5, 15);
      // Conto creato il 10 marzo con opening 500; +300 ad aprile. Saldo attuale = 800.
      const anchors = [{ openingBalance: 500, createdAt: new Date(2026, 2, 10) }];
      const txns: Tx[] = [{ date: new Date(2026, 3, 5), type: 'INCOME', amount: 300 }];
      const points = reconstructNetWorthSeries(800, txns, 6, now, anchors);
      // gen, feb (prima della creazione) = 0; mar = 500; apr/mag/giu = 800
      expect(points.map((p) => p.netWorth)).toEqual([0, 0, 500, 800, 800, 800]);
    });

    it('aggregato: somma di ancore di conti con età diverse', () => {
      const now = new Date(2026, 2, 15); // 15 mar 2026
      // Conto A: opening 1000, creato a gennaio (prima del range). Conto B: opening
      // 400, creato il 5 febbraio. Saldo attuale aggregato = 1400, nessun movimento.
      const anchors = [
        { openingBalance: 1000, createdAt: new Date(2026, 0, 5) },
        { openingBalance: 400, createdAt: new Date(2026, 1, 5) },
      ];
      const points = reconstructNetWorthSeries(1400, [], 3, now, anchors);
      // gen: solo A esiste a fine gennaio (B creato a feb) = 1000
      // feb: A + B = 1400 ; mar (oggi) = 1400
      expect(points.map((p) => p.netWorth)).toEqual([1000, 1400, 1400]);
    });

    it('accetta openingBalance come stringa (Decimal serializzato)', () => {
      const now = new Date(2026, 5, 15);
      const anchors = [{ openingBalance: '250.50', createdAt: new Date(2026, 4, 1) }];
      const points = reconstructNetWorthSeries(250.5, [], 3, now, anchors);
      // apr (prima della creazione di maggio) = 0 ; mag/giu = 250.50
      expect(points.map((p) => p.netWorth)).toEqual([0, 250.5, 250.5]);
    });

    it('senza ancore mantiene il comportamento originale (retrocompatibile)', () => {
      const now = new Date(2026, 5, 15);
      const points = reconstructNetWorthSeries(1000, [], 4, now);
      expect(points.every((p) => p.netWorth === 1000)).toBe(true);
    });
  });
});
