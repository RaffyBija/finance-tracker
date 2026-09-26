// ── Helper: conta le occorrenze reali di una ricorrente in un range ───────────
//
//   Logica:
//   - WEEKLY  → conta quanti lunedì (o qualsiasi giorno settimanale) cadono tra start ed end
//               Semplificato: floor(diffGiorni / 7), con +1 se il giorno di partenza
//               della ricorrente non è stato ancora contato.
//   - MONTHLY → conta i mesi in cui il dayOfMonth cade all'interno di [start, end].
//               Itera mese per mese e verifica se la data costruita è nel range.
//   - YEARLY  → conta gli anni in cui la data anniversario (mese+giorno di startDate
//               della ricorrente) cade all'interno di [start, end].
//
//   Ritorna { occurrences, effectiveAmount } dove effectiveAmount tiene già conto
//   dell'importo unitario × occorrenze.

export type OccurrenceRule = {
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  amount: any;
};

// Elenca le DATE esatte in cui una ricorrente cade nel range [rangeStart, rangeEnd].
// Fonte di verità unica della cadenza: countOccurrences ne ritorna solo il conteggio,
// la proiezione (getProjectionSeries) usa le date per posizionare gli eventi nel tempo.
export function listOccurrenceDates(
  rec: OccurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  // La ricorrente deve essere attiva almeno in parte nel range
  const recStart = rec.startDate > rangeStart ? rec.startDate : rangeStart;
  const recEnd   = rec.endDate && rec.endDate < rangeEnd ? rec.endDate : rangeEnd;

  if (recStart > recEnd) return [];

  const dates: Date[] = [];

  switch (rec.frequency) {
    case 'WEEKLY': {
      // Ogni 7 giorni a partire da rec.startDate originale
      // Troviamo la prima occorrenza >= recStart
      const msPerWeek  = 7 * 24 * 60 * 60 * 1000;
      const originTime = rec.startDate.getTime();
      const startTime  = recStart.getTime();
      const endTime    = recEnd.getTime();

      // Quante settimane intere dall'origine fino a recStart
      const weeksToStart = Math.ceil((startTime - originTime) / msPerWeek);
      let   current      = new Date(originTime + weeksToStart * msPerWeek);

      while (current.getTime() <= endTime) {
        dates.push(new Date(current.getTime()));
        current = new Date(current.getTime() + msPerWeek);
      }
      break;
    }

    case 'MONTHLY': {
      // Il giorno del mese è dayOfMonth (es. 5, 10, 20, 30)
      // Itera mese per mese tra recStart e recEnd
      const day = rec.dayOfMonth ?? rec.startDate.getDate();

      const cursor = new Date(recStart.getFullYear(), recStart.getMonth(), 1);
      const endMonth = new Date(recEnd.getFullYear(), recEnd.getMonth(), 1);

      while (cursor <= endMonth) {
        // Gestisce mesi con meno giorni (es. 30 febbraio → ultimo giorno del mese)
        const daysInMonth   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const effectiveDay  = Math.min(day, daysInMonth);
        const occurrence    = new Date(cursor.getFullYear(), cursor.getMonth(), effectiveDay);

        if (occurrence >= recStart && occurrence <= recEnd) {
          dates.push(occurrence);
        }

        cursor.setMonth(cursor.getMonth() + 1);
      }
      break;
    }

    case 'YEARLY': {
      // La data anniversario è il mese e giorno di rec.startDate
      const originMonth = rec.startDate.getMonth();
      const originDay   = rec.startDate.getDate();

      const startYear = recStart.getFullYear();
      const endYear   = recEnd.getFullYear();

      for (let year = startYear; year <= endYear; year++) {
        const daysInMonth  = new Date(year, originMonth + 1, 0).getDate();
        const effectiveDay = Math.min(originDay, daysInMonth);
        const occurrence   = new Date(year, originMonth, effectiveDay);

        if (occurrence >= recStart && occurrence <= recEnd) {
          dates.push(occurrence);
        }
      }
      break;
    }
  }

  return dates;
}

export function countOccurrences(
  rec: OccurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  return listOccurrenceDates(rec, rangeStart, rangeEnd).length;
}
