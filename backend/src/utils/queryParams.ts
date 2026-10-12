// Parametri numerici da query string: mai fidarsi del client. `parseInt` lascia passare valori
// negativi (un `take` negativo di Prisma significa "tutto") e NaN (500): qui si riporta sempre
// a un intero dentro [min, max], con `def` per i valori assenti o non numerici.
export function clampInt(raw: unknown, def: number, min: number, max: number): number {
  const n = typeof raw === 'string' || typeof raw === 'number' ? parseInt(String(raw), 10) : NaN;
  const value = Number.isFinite(n) ? n : def;
  return Math.min(Math.max(value, min), max);
}
