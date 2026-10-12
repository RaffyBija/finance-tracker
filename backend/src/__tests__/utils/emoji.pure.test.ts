import { describe, it, expect } from 'vitest';
import { isSingleEmoji } from '../../utils/emoji';
import { DEFAULT_CATEGORIES } from '../../utils/defaultCategories';

describe('isSingleEmoji', () => {
  it('accetta emoji singole, anche con variation selector, ZWJ e skin tone', () => {
    for (const e of ['😀', '⏱️', '🏷️', '↩️', '🅿️', '👨‍👩‍👧', '👍🏽']) expect(isSingleEmoji(e), e).toBe(true);
  });

  it('le bandiere (indicatori regionali) non sono Extended_Pictographic: rifiutate', () => {
    expect(isSingleEmoji('🇮🇹')).toBe(false);
  });

  it('rifiuta vuoto, testo, più emoji, emoji + testo, non stringhe', () => {
    for (const v of ['', ' ', 'a', '1', '€', '😀😀', '😀a', 'a😀', '😀 ', null, undefined, 5]) {
      expect(isSingleEmoji(v), String(v)).toBe(false);
    }
  });

  it('tutte le icone predefinite (backend) sono valide', () => {
    for (const m of DEFAULT_CATEGORIES) {
      for (const c of [m, ...m.children]) expect(isSingleEmoji(c.icon), c.name).toBe(true);
    }
  });
});
