// Giorni mancanti al prossimo addebito di una carta di credito, dato il
// billingDay (1-31). Gestisce il rollover al mese successivo e i mesi corti.
export function daysUntilBilling(billingDay: number): number {
  const today = new Date();
  const day = today.getDate();
  if (billingDay === day) return 0;
  if (billingDay > day) return billingDay - day;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return daysInMonth - day + billingDay;
}
