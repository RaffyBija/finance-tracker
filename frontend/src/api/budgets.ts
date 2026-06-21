import apiClient from './client';
import type { Budget, BudgetHistory, BudgetSuggestions, CreateBudgetDTO } from '../types';

export const budgetApi = {
  getAll: async (params?: { active?: boolean }): Promise<Budget[]> => {
    const response = await apiClient.get<Budget[]>('/budgets', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Budget> => {
    const response = await apiClient.get<Budget>(`/budgets/${id}`);
    return response.data;
  },

  getHistory: async (id: string, periods?: number): Promise<BudgetHistory> => {
    const response = await apiClient.get<BudgetHistory>(`/budgets/${id}/history`, {
      params: periods ? { periods } : undefined,
    });
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

  getSuggestions: async (savingRate?: number): Promise<BudgetSuggestions> => {
    const response = await apiClient.get<BudgetSuggestions>('/budgets/suggestions', {
      params: savingRate !== undefined ? { savingRate } : undefined,
    });
    return response.data;
  },

  applySuggestions: async (
    items: Array<{ categoryId: string; amount: number }>,
  ): Promise<{ applied: number }> => {
    const response = await apiClient.post<{ applied: number }>('/budgets/apply-suggestions', {
      items,
    });
    return response.data;
  },
};