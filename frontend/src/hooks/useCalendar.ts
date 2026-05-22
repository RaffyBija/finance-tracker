import { useQuery } from '@tanstack/react-query';
import { calendarApi } from '../api/calendar';
import type { CalendarData } from '../api/calendar';

export function useCalendar(year: number, month: number) {
  return useQuery<CalendarData>({
    queryKey: ['calendar', year, month],
    queryFn: () => calendarApi.getEvents(year, month),
    staleTime: 60 * 1000,
  });
}
