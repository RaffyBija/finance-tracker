import apiClient from './client';
import type { PlannedTransaction, CreatePlannedTransactionDTO } from '../types/index';

export const plannedApi = {
  getAll: async (params?: { unpaidOnly?: boolean; upcoming?: boolean }): Promise<PlannedTransaction[]> => {
    const response = await apiClient.get<PlannedTransaction[]>('/planned', { params });
    return response.data;
  },

  getById: async (id: string): Promise<PlannedTransaction> => {
    const response = await apiClient.get<PlannedTransaction>(`/planned/${id}`);
    return response.data;
  },

  create: async (data: CreatePlannedTransactionDTO): Promise<PlannedTransaction> => {
    const response = await apiClient.post<PlannedTransaction>('/planned', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreatePlannedTransactionDTO>): Promise<PlannedTransaction> => {
    const response = await apiClient.put<PlannedTransaction>(`/planned/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/planned/${id}`);
  },

  markAsPaid: async (id: string): Promise<{ planned: PlannedTransaction; transaction: any; message: string }> => {
    const response = await apiClient.patch(`/planned/${id}/mark-paid`);
    return response.data;
  },
};