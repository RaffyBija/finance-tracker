import { createContext, useContext, type ReactNode } from 'react';

// Mese selezionato nell'Hero della Dashboard, condiviso coi widget mese-dipendenti
// (es. "Spese per categoria"). Lo stato vive in DashboardPage — l'Hero lo controlla —
// e qui viene solo esposto in sola lettura ai widget.

interface DashboardMonthValue {
  currentMonth: Date;
  monthRange: { startDate: string; endDate: string };
  isCurrentMonth: boolean;
}

const DashboardMonthContext = createContext<DashboardMonthValue | null>(null);

export function DashboardMonthProvider({
  value,
  children,
}: {
  value: DashboardMonthValue;
  children: ReactNode;
}) {
  return (
    <DashboardMonthContext.Provider value={value}>
      {children}
    </DashboardMonthContext.Provider>
  );
}

export function useDashboardMonth(): DashboardMonthValue {
  const ctx = useContext(DashboardMonthContext);
  if (!ctx) {
    throw new Error('useDashboardMonth deve essere usato dentro DashboardMonthProvider');
  }
  return ctx;
}
