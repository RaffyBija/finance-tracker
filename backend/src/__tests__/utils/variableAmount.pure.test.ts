import { describe, it, expect } from 'vitest';
import { medianOfRecent, confirmedAmounts } from '../../utils/variableAmount';

describe('medianOfRecent', () => {
  it('mediana degli ultimi 3 (dal più recente), ignora i più vecchi', () => {
    expect(medianOfRecent([1700, 1760, 1650, 9999])).toBe(1700);
  });
  it('un mese anomalo non sposta la stima', () => {
    expect(medianOfRecent([3400, 1700, 1720])).toBe(1720);
  });
  it('con 2 importi: media dei due', () => {
    expect(medianOfRecent([1700, 1761])).toBe(1730.5);
  });
  it('con 1 importo: quello', () => {
    expect(medianOfRecent([1712.34])).toBe(1712.34);
  });
  it('nessun importo → null', () => {
    expect(medianOfRecent([])).toBeNull();
  });
});

describe('confirmedAmounts', () => {
  const at = (iso: string, ms = 0) => new Date(new Date(iso).getTime() + ms);

  it('per ogni registrazione conta solo la scadenza corrente, non gli arretrati alla stima', () => {
    const run = at('2026-10-02T10:00:00Z');
    const txs = [
      { amount: 1800, date: at('2026-07-01'), createdAt: at('2026-07-01T09:00:00Z') }, // registrazione precedente
      { amount: 1700, date: at('2026-08-01'), createdAt: run },                         // arretrato (stima)
      { amount: 1700, date: at('2026-09-01'), createdAt: at('2026-10-02T10:00:00Z', 3) }, // arretrato (stima)
      { amount: 1900, date: at('2026-10-01'), createdAt: at('2026-10-02T10:00:00Z', 6) }, // confermato
    ];
    expect(confirmedAmounts(txs)).toEqual([1900, 1800]);
    expect(medianOfRecent(confirmedAmounts(txs))).toBe(1850);
  });

  it('registrazioni separate restano distinte', () => {
    const txs = [
      { amount: 1700, date: at('2026-08-23'), createdAt: at('2026-08-23T08:00:00Z') },
      { amount: 1760, date: at('2026-09-23'), createdAt: at('2026-09-23T08:00:00Z') },
    ];
    expect(confirmedAmounts(txs)).toEqual([1760, 1700]);
  });
});
