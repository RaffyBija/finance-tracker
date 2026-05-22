import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '../api/analytics';

export const useForecast = () => {
  return useQuery({
    queryKey: ['analytics', 'forecast'],
    queryFn: analyticsAPI.getForecast,
    staleTime: 10 * 60 * 1000, // 10 minuti — il backend ha cache 5min, non serve refresh frequente
  });
};
