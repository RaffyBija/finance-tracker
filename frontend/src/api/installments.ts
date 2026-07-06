import apiClient from './client';
import type {
  InstallmentPlan,
  CreateInstallmentPlanDTO,
  UpdateInstallmentPlanDTO,
  PayInstallmentsDTO,
} from '../types/index';

export const installmentsApi = {
  getAll: async (): Promise<InstallmentPlan[]> => {
    const response = await apiClient.get<InstallmentPlan[]>('/installments');
    return response.data;
  },

  getById: async (id: string): Promise<InstallmentPlan> => {
    const response = await apiClient.get<InstallmentPlan>(`/installments/${id}`);
    return response.data;
  },

  create: async (data: CreateInstallmentPlanDTO): Promise<InstallmentPlan> => {
    const response = await apiClient.post<InstallmentPlan>('/installments', data);
    return response.data;
  },

  update: async (id: string, data: UpdateInstallmentPlanDTO): Promise<InstallmentPlan> => {
    const response = await apiClient.put<InstallmentPlan>(`/installments/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/installments/${id}`);
  },

  pay: async (data: PayInstallmentsDTO): Promise<{ transaction: unknown; count: number; message: string }> => {
    const response = await apiClient.post('/installments/pay', data);
    return response.data;
  },
};
