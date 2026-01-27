import apiClient from './client';
import type { RecurringTransaction, CreateRecurringTransactionDTO } from '../types';

export const recurringApi = {
  getAll: async (params?: { active?: boolean }): Promise<RecurringTransaction[]> => {
    const response = await apiClient.get<RecurringTransaction[]>('/recurring', { params });
    return response.data;
  },

  getById: async (id: string): Promise<RecurringTransaction> => {
    const response = await apiClient.get<RecurringTransaction>(`/recurring/${id}`);
    return response.data;
  },

  create: async (data: CreateRecurringTransactionDTO): Promise<RecurringTransaction> => {
    const response = await apiClient.post<RecurringTransaction>('/recurring', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateRecurringTransactionDTO>): Promise<RecurringTransaction> => {
    const response = await apiClient.put<RecurringTransaction>(`/recurring/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/recurring/${id}`);
  },

  toggle: async (id: string): Promise<RecurringTransaction> => {
    const response = await apiClient.patch<RecurringTransaction>(`/recurring/${id}/toggle`);
    return response.data;
  },
};