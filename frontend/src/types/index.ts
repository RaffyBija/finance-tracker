// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

// Transaction types
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  categoryId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface CreateTransactionDTO {
  amount: number;
  type: TransactionType;
  description?: string;
  date?: string;
  categoryId?: string;
}

export interface UpdateTransactionDTO {
  amount?: number;
  type?: TransactionType;
  description?: string;
  date?: string;
  categoryId?: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color?: string;
  icon?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    transactions: number;
  };
}

export interface CreateCategoryDTO {
  name: string;
  type: TransactionType;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryDTO {
  name?: string;
  color?: string;
  icon?: string;
}

// Dashboard types
export interface Summary {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  period: {
    startDate: string | null;
    endDate: string | null;
  };
}

export interface CategoryStat {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  type: TransactionType;
  total: number;
  count: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface ProjectedBalance {
  currentBalance: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  projectionMonths: number;
  recurringCount: number;
  plannedCount: number;
}

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Frequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Budget {
  id: string;
  name: string;
  amount: number;
  categoryId?: string;
  period: BudgetPeriod;
  startDate: string;
  endDate?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  spent?: number;
  remaining?: number;
  percentage?: number;
}

export interface CreateBudgetDTO {
  name: string;
  amount: number;
  categoryId?: string;
  period: BudgetPeriod;
  startDate: string;
  endDate?: string;
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  frequency: Frequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface CreateRecurringTransactionDTO {
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  frequency: Frequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
}

// API Error
export interface ApiError {
  error: string;
}


export interface PlannedTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  plannedDate: string;
  isPaid: boolean;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface CreatePlannedTransactionDTO {
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  plannedDate: string;
  notes?: string;
}

//Alert Interface

type AlertType = 'success' | 'info' | 'warning' | 'error' | ''

export interface AlertPopUp{
  tipo: AlertType;
  messaggio: string;
  checked: boolean;
}