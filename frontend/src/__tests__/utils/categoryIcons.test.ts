import { describe, it, expect } from 'vitest';
import { ICONS } from '../../utils/categoryIcons';
import { isSingleEmoji } from '../../utils/emoji';

describe('ICONS (selettore categoria)', () => {
  it('senza duplicati e tutte emoji singole valide', () => {
    expect(new Set(ICONS).size).toBe(ICONS.length);
    for (const i of ICONS) expect(isSingleEmoji(i), i).toBe(true);
  });
});
