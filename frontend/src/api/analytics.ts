import api from './client';
import type { Forecast, PayPeriod, SpendingAnalysis, NetWorthNow } from '../types';

export const analyticsAPI = {
  getForecast: async (): Promise<Forecast> => {
    const { data } = await api.get('/analytics/forecast');
    return data;
  },

  getSpending: async (params: { periods: number; mode: 'pay' | 'month' }): Promise<SpendingAnalysis> => {
    const { data } = await api.get('/analytics/spending', { params });
    return data;
  },

  getNetWorthNow: async (): Promise<NetWorthNow> => {
    const { data } = await api.get('/analytics/net-worth');
    return data;
  },

  getPayPeriod: async (): Promise<PayPeriod> => {
    const { data } = await api.get('/analytics/pay-period');
    return data;
  },
};
