import axios from 'axios';
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
  Transaction,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  Category,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  Summary,
  CategoryStat,
  MonthlyTrend,
  ProjectedBalance
} from '../types';

const API_URL = import.meta.env.VITE_API_URL;

// Crea istanza axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere il token ad ogni richiesta
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor per gestire errori di autenticazione
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (credentials: RegisterCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', credentials);
    return data;
  },

  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },
};

// Transaction API
export const transactionAPI = {
  getAll: async (params?: {
    type?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> => {
    const { data } = await api.get<Transaction[]>('/transactions', { params });
    return data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const { data } = await api.get<Transaction>(`/transactions/${id}`);
    return data;
  },

  create: async (transaction: CreateTransactionDTO): Promise<Transaction> => {
    const { data } = await api.post<Transaction>('/transactions', transaction);
    return data;
  },

  update: async (id: string, transaction: UpdateTransactionDTO): Promise<Transaction> => {
    const { data } = await api.put<Transaction>(`/transactions/${id}`, transaction);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },
};

// Category API
export const categoryAPI = {
  getAll: async (params?: { type?: string }): Promise<Category[]> => {
    const { data } = await api.get<Category[]>('/categories', { params });
    return data;
  },

  getById: async (id: string): Promise<Category> => {
    const { data } = await api.get<Category>(`/categories/${id}`);
    return data;
  },

  create: async (category: CreateCategoryDTO): Promise<Category> => {
    const { data } = await api.post<Category>('/categories', category);
    return data;
  },

  update: async (id: string, category: UpdateCategoryDTO): Promise<Category> => {
    const { data } = await api.put<Category>(`/categories/${id}`, category);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};

// Dashboard API
export const dashboardAPI = {
  getSummary: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Summary> => {
    const { data } = await api.get<Summary>('/dashboard/summary', { params });
    return data;
  },

  getCategoryStats: async (params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }): Promise<CategoryStat[]> => {
    const { data } = await api.get<CategoryStat[]>('/dashboard/category-stats', { params });
    return data;
  },

  getRecent: async (limit?: number): Promise<Transaction[]> => {
    const { data } = await api.get<Transaction[]>('/dashboard/recent', {
      params: { limit },
    });
    return data;
  },

  getMonthlyTrend: async (months?: number): Promise<MonthlyTrend[]> => {
    const { data } = await api.get<MonthlyTrend[]>('/dashboard/monthly-trend', {
      params: { months },
    });
    return data;
  },

  getProjectedBalance: async (months: number = 3): Promise<ProjectedBalance> => {
    const response = await api.get<ProjectedBalance>('/dashboard/projected-balance', {
      params: { months },
    });
    return response.data;
  },
};

export default api;