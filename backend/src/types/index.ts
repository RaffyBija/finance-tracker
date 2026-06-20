import { Request } from 'express';

// Estendi Request per includere userId dopo autenticazione
export interface AuthRequest extends Request {
  userId?: string;
}

// DTO per registrazione
export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  currency?: string;
}

// DTO per login
export interface LoginDTO {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Riga di ripartizione per una transazione divisa (split)
export interface TransactionItemDTO {
  amount: number;
  categoryId?: string | null;
  description?: string | null;
}

// DTO per creare transazione
export interface CreateTransactionDTO {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description?: string;
  date?: Date;
  categoryId?: string;
  // Se valorizzato (>= 2 righe): transazione divisa su più categorie.
  // Consentito solo per EXPENSE. La somma delle righe deve eguagliare amount.
  items?: TransactionItemDTO[];
}

// DTO per creare categoria
export interface CreateCategoryDTO {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  color?: string;
  icon?: string;
}

// Response JWT
export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    isPro: boolean;
    tourCompleted: boolean;
    currency: string;
  };
}

// Budget DTOs
export interface CreateBudgetDTO {
  name: string;
  amount: number;
  categoryId?: string;
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: Date;
  endDate?: Date;
}

// Recurring Transaction DTOs
export interface CreateRecurringTransactionDTO {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  categoryId?: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date;
}

// Planned Transaction DTOs
export interface CreatePlannedTransactionDTO {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  categoryId?: string;
  plannedDate: Date;
  notes?: string;
}

// Account DTOs
export interface CreateAccountDTO {
  name: string;
  type: 'BANK' | 'CREDIT_CARD';
  color?: string;
  icon?: string;
  openingBalance?: number;
  creditLimit?: number;
  billingDay?: number;
  linkedAccountId?: string;
}