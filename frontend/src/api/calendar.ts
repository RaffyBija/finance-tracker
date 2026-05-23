import apiClient from './client';

export interface CalendarCategory {
  id?: string;
  name: string;
  color?: string;
  icon?: string;
}

export interface CalendarEvent {
  id: string;
  source: 'actual' | 'planned' | 'recurring';
  transactionType: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  isPaid?: boolean;
  recurringId?: string;
  category: CalendarCategory | null;
}

export interface CalendarDay {
  income: number;
  expenses: number;
  events: CalendarEvent[];
}

export interface CalendarData {
  year: number;
  month: number;
  days: Record<string, CalendarDay>;
  openingBalance: number;
}

export const calendarApi = {
  getEvents: async (year: number, month: number): Promise<CalendarData> => {
    const { data } = await apiClient.get<CalendarData>('/calendar/events', { params: { year, month } });
    return data;
  },
};
