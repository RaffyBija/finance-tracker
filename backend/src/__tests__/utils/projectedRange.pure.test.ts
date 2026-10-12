import { describe, it, expect } from 'vitest';
import { normalizeProjectedRange, MAX_PROJECTED_SPAN_DAYS } from '../../utils/projectedRange';

describe('normalizeProjectedRange', () => {
  it('normalizza a inizio e fine giornata', () => {
    const r = normalizeProjectedRange(new Date(2026, 9, 12, 15, 30), new Date(2026, 10, 12, 8, 0))!;
    expect(r.rangeStart.getHours()).toBe(0);
    expect(r.rangeEnd.getHours()).toBe(23);
    expect(r.rangeEnd.getMilliseconds()).toBe(999);
  });

  it('rifiuta date non valide e intervalli invertiti', () => {
    expect(normalizeProjectedRange(new Date('x'), new Date(2026, 10, 1))).toBeNull();
    expect(normalizeProjectedRange(new Date(2026, 10, 1), new Date(NaN))).toBeNull();
    expect(normalizeProjectedRange(new Date(2026, 10, 5), new Date(2026, 10, 1))).toBeNull();
  });

  it('porta a ~3 anni un intervallo enorme (1970 → anno 200000)', () => {
    const r = normalizeProjectedRange(new Date('1970-01-01'), new Date('+200000-01-01T00:00:00Z'))!;
    const days = (r.rangeEnd.getTime() - r.rangeStart.getTime()) / 86400000;
    expect(days).toBeLessThanOrEqual(MAX_PROJECTED_SPAN_DAYS + 1);
    expect(days).toBeGreaterThan(MAX_PROJECTED_SPAN_DAYS - 1);
  });

  it('non tocca un intervallo entro il tetto', () => {
    const r = normalizeProjectedRange(new Date(2026, 0, 1), new Date(2026, 11, 31))!;
    expect(r.rangeEnd.getFullYear()).toBe(2026);
    expect(r.rangeEnd.getMonth()).toBe(11);
  });
});
