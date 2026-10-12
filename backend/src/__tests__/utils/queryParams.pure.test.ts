import { describe, it, expect } from 'vitest';
import { clampInt } from '../../utils/queryParams';

describe('clampInt', () => {
  it('valori validi dentro i limiti passano', () => {
    expect(clampInt('50', 200, 1, 200)).toBe(50);
    expect(clampInt(7, 10, 1, 100)).toBe(7);
  });

  it('negativi e zero salgono al minimo (take negativo di Prisma = tutto)', () => {
    expect(clampInt('-1e9', 200, 1, 200)).toBe(1); // parseInt('-1e9') = -1
    expect(clampInt('-5', 200, 1, 200)).toBe(1);
    expect(clampInt('0', 200, 1, 200)).toBe(1);
    expect(clampInt('-3', 0, 0, 1_000_000)).toBe(0);
  });

  it('oltre il massimo scendono al massimo', () => {
    expect(clampInt('999999', 10, 1, 100)).toBe(100);
  });

  it('assenti o non numerici → default (mai NaN, quindi mai 500)', () => {
    expect(clampInt(undefined, 10, 1, 100)).toBe(10);
    expect(clampInt('abc', 10, 1, 100)).toBe(10);
    expect(clampInt({ x: 1 }, 10, 1, 100)).toBe(10);
    expect(clampInt(['5', '6'], 10, 1, 100)).toBe(10);
    expect(clampInt('', 10, 1, 100)).toBe(10);
  });

  it('il default viene riportato dentro i limiti', () => {
    expect(clampInt(undefined, 500, 1, 200)).toBe(200);
  });
});
