// Formattazione date — UNICO punto di verità per il display.
// Oggi locale fisso it; quando arriverà l'i18n della lingua, il locale verrà
// derivato dalle preferenze utente passando solo da qui (come format.ts per la
// valuta). I formati "macchina" (yyyy-MM-dd per API, chiavi React) NON passano
// di qui: usano direttamente date-fns dove servono.
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const LOCALE = it;

const toDate = (d: string | Date): Date => (d instanceof Date ? d : new Date(d));
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// 29 mag 2026
export const formatDateShort = (d: string | Date): string =>
  format(toDate(d), 'dd MMM yyyy', { locale: LOCALE });

// 29 maggio 2026
export const formatDateLong = (d: string | Date): string =>
  format(toDate(d), 'dd MMMM yyyy', { locale: LOCALE });

// Venerdì, 29 maggio 2026 (header di gruppo)
export const formatDateFull = (d: string | Date): string =>
  cap(format(toDate(d), 'EEEE, dd MMMM yyyy', { locale: LOCALE }));

// 29 mag (giorno + mese breve)
export const formatDayMonth = (d: string | Date): string =>
  format(toDate(d), 'dd MMM', { locale: LOCALE });

// 29 maggio (giorno + mese lungo, senza anno)
export const formatDayMonthLong = (d: string | Date): string =>
  format(toDate(d), 'd MMMM', { locale: LOCALE });

// Maggio 2026 (header mese, capitalizzato)
export const formatMonthYear = (d: string | Date): string =>
  cap(format(toDate(d), 'MMMM yyyy', { locale: LOCALE }));

// Maggio (nome mese, capitalizzato)
export const formatMonth = (d: string | Date): string =>
  cap(format(toDate(d), 'MMMM', { locale: LOCALE }));

// mag (mese breve, per assi grafici — lowercase)
export const formatMonthShort = (d: string | Date): string =>
  format(toDate(d), 'MMM', { locale: LOCALE });
