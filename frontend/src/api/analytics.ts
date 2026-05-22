import api from './client';
import type { Forecast } from '../types';

export const analyticsAPI = {
  getForecast: async (): Promise<Forecast> => {
    const { data } = await api.get('/analytics/forecast');
    return data;
  },
};
