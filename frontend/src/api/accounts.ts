import api from './client';
import type { Account, CreateAccountDTO, UpdateAccountDTO } from '../types';

export const accountsAPI = {
  getAll: async (): Promise<Account[]> => {
    const { data } = await api.get<Account[]>('/accounts');
    return data;
  },

  getById: async (id: string): Promise<Account> => {
    const { data } = await api.get<Account>(`/accounts/${id}`);
    return data;
  },

  create: async (account: CreateAccountDTO): Promise<Account> => {
    const { data } = await api.post<Account>('/accounts', account);
    return data;
  },

  update: async (id: string, account: UpdateAccountDTO): Promise<Account> => {
    const { data } = await api.put<Account>(`/accounts/${id}`, account);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/accounts/${id}`);
  },

  setDefault: async (id: string): Promise<void> => {
    await api.patch(`/accounts/${id}/default`);
  },

  settle: async (id: string, categoryId?: string): Promise<{ settledAmount: number }> => {
    const { data } = await api.post<{ settledAmount: number }>(`/accounts/${id}/settle`, { categoryId });
    return data;
  },
};
