// Tono di una variazione: lo zero è NEUTRO, non un "successo" verde.
// Condiviso tra le lenti del Patrimonio per coerenza di colore/segno.

export type Tone = 'positive' | 'negative' | 'neutral';

export const toneOf = (n: number): Tone => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');

export const signOf = (n: number): string => (n > 0 ? '+' : n < 0 ? '−' : '');
