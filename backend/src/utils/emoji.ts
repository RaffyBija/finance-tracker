// Un'icona categoria valida è esattamente UNA emoji (un solo grafema pittografico).
// Stessa regola del modal categoria nel frontend (frontend/src/utils/emoji.ts).
// Intl.Segmenter c'è a runtime (Node 16+) ma non nei tipi della lib ES2020 del backend.
interface GraphemeSegmenter {
  segment(s: string): Iterable<unknown>;
}
type SegmenterCtor = new (locale?: string, opts?: { granularity: 'grapheme' }) => GraphemeSegmenter;

export function isSingleEmoji(value: unknown): value is string {
  if (typeof value !== 'string' || !/\p{Extended_Pictographic}/u.test(value)) return false;
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (!Segmenter) return Array.from(value).length === 1;
  return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length === 1;
}
