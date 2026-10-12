// Un'icona categoria valida è esattamente UNA emoji (un solo grafema pittografico).
// Stessa regola del backend (backend/src/utils/emoji.ts).
export function isSingleEmoji(value: string): boolean {
  if (!/\p{Extended_Pictographic}/u.test(value)) return false;
  // Segmenter creato qui (non a livello di modulo): i browser senza Intl.Segmenter non rompono il bundle.
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return Array.from(value).length === 1;
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length === 1;
}
