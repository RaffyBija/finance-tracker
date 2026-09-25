import { describe, it, expect } from 'vitest';
import { projectCcCharges, type CcEvent, type AccountBalance } from '../../utils/balance';

// Carta "Fine mese" (closingDay=31), addebito il 15, conto collegato 'bank'.
// now = 6 lug 2026 → ciclo aperto = 1–31 lug, addebito = 15 ago (nextBillingDate(15, 31 lug)).
const NOW = new Date(2026, 6, 6); // 6 lug 2026

function card(balance: number): AccountBalance {
  return {
    id: 'cc1',
    type: 'CREDIT_CARD',
    openingBalance: 0,
    billingDay: 15,
    closingDay: 31,
    linkedAccountId: 'bank',
    balance, // negativo = debito
  };
}

function bank(): AccountBalance {
  return {
    id: 'bank',
    type: 'BANK',
    openingBalance: 0,
    billingDay: null,
    closingDay: null,
    linkedAccountId: null,
    balance: 1000,
  };
}

function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

const RANGE_START = new Date(2026, 6, 6);  // 6 lug
const RANGE_END   = new Date(2026, 9, 6);  // 6 ott

describe('projectCcCharges — debito ciclo aperto seminato da cc.balance', () => {
  it('emette un unico addebito al billingDay del ciclo (15 ago) pari al debito', () => {
    const charges = projectCcCharges([bank(), card(-100)], [], RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(1);
    expect(charges[0].amount).toBeCloseTo(100, 2);
    expect(charges[0].cardId).toBe('cc1');
    expect(ymd(charges[0].date)).toEqual({ y: 2026, m: 7, d: 15 }); // 15 ago
  });

  it('carta senza debito e senza spese future → nessun addebito', () => {
    const charges = projectCcCharges([card(0)], [], RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(0);
  });
});

describe('projectCcCharges — spese future su CC', () => {
  it('spesa nel ciclo aperto si somma al debito seminato (unico addebito, no doppio conteggio)', () => {
    const events: CcEvent[] = [{ cardId: 'cc1', date: new Date(2026, 6, 28), signed: 16.99 }]; // 28 lug
    const charges = projectCcCharges([card(-100)], events, RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(1);
    expect(charges[0].amount).toBeCloseTo(116.99, 2);
    expect(ymd(charges[0].date)).toEqual({ y: 2026, m: 7, d: 15 }); // 15 ago
  });

  it('spesa in un ciclo futuro genera un addebito separato al suo billingDay', () => {
    // spesa 20 ago → ciclo 1–31 ago → addebito 15 set
    const events: CcEvent[] = [{ cardId: 'cc1', date: new Date(2026, 7, 20), signed: 42.78 }];
    const charges = projectCcCharges([card(-100)], events, RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(2);
    const byDate = [...charges].sort((a, b) => a.date.getTime() - b.date.getTime());
    expect(ymd(byDate[0].date)).toEqual({ y: 2026, m: 7, d: 15 });  // 15 ago: debito aperto 100
    expect(byDate[0].amount).toBeCloseTo(100, 2);
    expect(ymd(byDate[1].date)).toEqual({ y: 2026, m: 8, d: 15 });  // 15 set: spesa di agosto
    expect(byDate[1].amount).toBeCloseTo(42.78, 2);
  });

  it('rimborso (signed negativo) riduce il debito; netto ≤ 0 → nessun addebito', () => {
    const events: CcEvent[] = [{ cardId: 'cc1', date: new Date(2026, 6, 20), signed: -60 }];
    const charges = projectCcCharges([card(-50)], events, RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(0); // 50 − 60 = −10
  });
});

describe('projectCcCharges — filtro sul range', () => {
  it('non emette addebiti la cui data cade fuori dal range', () => {
    const shortEnd = new Date(2026, 7, 10); // 10 ago, prima del 15 ago
    const charges = projectCcCharges([card(-100)], [], RANGE_START, shortEnd, NOW);
    expect(charges).toHaveLength(0);
  });
});

describe('projectCcCharges — robustezza', () => {
  it('ignora i conti BANK e gli eventi di carte sconosciute', () => {
    const events: CcEvent[] = [{ cardId: 'ghost', date: new Date(2026, 6, 20), signed: 30 }];
    const charges = projectCcCharges([bank()], events, RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(0);
  });

  it('nessuna carta → nessun addebito', () => {
    const charges = projectCcCharges([bank()], [], RANGE_START, RANGE_END, NOW);
    expect(charges).toHaveLength(0);
  });
});
