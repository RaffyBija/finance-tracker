// Intervallo di `GET /dashboard/projected-balance`: normalizzato a inizio/fine giornata e con un
// tetto di durata. Senza tetto, un range come 1970 → anno 200000 farebbe generare a
// `listOccurrenceDates` milioni di date in modo sincrono (blocco dell'event loop / OOM).
export const MAX_PROJECTED_SPAN_DAYS = 1095; // ~3 anni, come getProjectionSeries

// null se una delle due date non è valida o se l'inizio non precede la fine.
export function normalizeProjectedRange(
  start: Date,
  end: Date,
  maxDays = MAX_PROJECTED_SPAN_DAYS,
): { rangeStart: Date; rangeEnd: Date } | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const rangeStart = new Date(start);
  let rangeEnd = new Date(end);
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  if (rangeStart >= rangeEnd) return null;
  if (rangeEnd.getTime() - rangeStart.getTime() > maxDays * 86400000) {
    // setDate (non millisecondi) per restare calendar-safe attraverso l'ora legale.
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + maxDays);
    rangeEnd.setHours(23, 59, 59, 999);
  }
  return { rangeStart, rangeEnd };
}
