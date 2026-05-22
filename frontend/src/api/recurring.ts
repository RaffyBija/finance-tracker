import apiClient from './client';
import type { RecurringTransaction, CreateRecurringTransactionDTO, RecurringDueResponse, ExecuteRecurringResult } from '../types';

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

  getDue: async (): Promise<RecurringDueResponse> => {
    const response = await apiClient.get<RecurringDueResponse>('/recurring/due');
    return response.data;
  },

  execute: async (ids: string[]): Promise<ExecuteRecurringResult> => {
    const response = await apiClient.post<ExecuteRecurringResult>('/recurring/execute', { ids });
    return response.data;
  },

  executeNow: async (id: string): Promise<void> => {
    await apiClient.post(`/recurring/${id}/execute-now`);
  },
};