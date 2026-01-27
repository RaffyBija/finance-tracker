import apiClient from './client';
import type { Budget, CreateBudgetDTO } from '../types';

export const budgetApi = {
  getAll: async (params?: { active?: boolean }): Promise<Budget[]> => {
    const response = await apiClient.get<Budget[]>('/budgets', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Budget> => {
    const response = await apiClient.get<Budget>(`/budgets/${id}`);
    return response.data;
  },

  create: async (data: CreateBudgetDTO): Promise<Budget> => {
    const response = await apiClient.post<Budget>('/budgets', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateBudgetDTO>): Promise<Budget> => {
    const response = await apiClient.put<Budget>(`/budgets/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/budgets/${id}`);
  },
};