// User types
export interface User {
  id: string;
  email: string;
  name: string;
  isPro: boolean;
  tourCompleted: boolean;
  currency: string;
  // Percentuale di risparmio target (0–0.9) usata dal budget automatico
  savingRate: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  currency?: string;
}

// Transaction types
export type TransactionType = 'INCOME' | 'EXPENSE';

// Riga di ripartizione di una transazione divisa (split): l'importo del padre è
// suddiviso tra le righe, ciascuna con la propria categoria.
export interface TransactionItem {
  id?: string;
  amount: number;
  categoryId?: string | null;
  description?: string | null;
  category?: Category | null;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
  categoryId?: string;
  accountId?: string | null;
  userId: string;
  transferId?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  account?: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
  // Conto "peer" dell'altra gamba del trasferimento (popolato dal backend).
  transferPeer?: Pick<Account, 'id' | 'name' | 'color'> | null;
  // Presenti (>= 2) solo per le transazioni divise su più categorie.
  items?: TransactionItem[];
}

// Riga inviata al backend per creare/aggiornare una transazione divisa.
export interface TransactionItemInput {
  amount: number;
  categoryId: string;
  description?: string | null;
}

export interface CreateTransactionDTO {
  amount: number;
  type: TransactionType;
  description?: string;
  date?: string;
  categoryId?: string;
  accountId?: string;
  // Se valorizzato (>= 2 righe): transazione divisa. Solo per EXPENSE.
  items?: TransactionItemInput[];
}

export interface CreateTransferDTO {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  description?: string;
}

export interface UpdateTransactionDTO {
  amount?: number;
  type?: TransactionType;
  description?: string;
  date?: string;
  categoryId?: string;
  accountId?: string | null;
  // [] = converti a transazione semplice; >= 2 righe = transazione divisa.
  items?: TransactionItemInput[];
}

// Category types
export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color?: string;
  icon?: string;
  userId: string;
  // Categoria gestita dal sistema (es. "Pagamento Carta"): non modificabile/eliminabile.
  isSystem?: boolean;
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

// ── Serie temporale dell'andamento del saldo (grafico proiezione) ──
export interface ProjectionPoint {
  date: string;       // YYYY-MM-DD
  balance: number;    // saldo a fine giornata
  projected: boolean; // false = storia reale (solid), true = proiezione (dashed)
}

export interface ProjectionEvent {
  date: string;       // YYYY-MM-DD
  label: string;
  amount: number;
  type: TransactionType;
  source: 'recurring' | 'planned' | 'cc';
}

export interface ProjectionSeries {
  currentBalance: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  recurringCount: number;
  plannedCount: number;
  points: ProjectionPoint[];
  events: ProjectionEvent[];
}

// ── Andamento storico del patrimonio netto (liquidità) ──
export interface NetWorthPoint {
  month: string;    // YYYY-MM
  netWorth: number; // patrimonio (Σ conti BANK) a fine mese
}

export interface NetWorthSeries {
  points: NetWorthPoint[];
  current: number;            // patrimonio attuale (= hero dashboard)
  change: number;             // variazione tra primo e ultimo punto
  changePct: number | null;   // variazione % (null se base = 0)
}

// ── Andamento del patrimonio scomposto per conto (stacked area) ──
export interface NetWorthByAccountSeries {
  months: string[];           // chiavi mese allineate, YYYY-MM
  accounts: {
    id: string;
    name: string;
    color: string | null;
    points: NetWorthPoint[];  // un punto per mese (allineato a months)
  }[];
}

// ── Trend per categoria nel tempo (top N + "Altre") ──
export interface CategoryTrendSeries {
  months: string[];           // chiavi mese allineate, YYYY-MM
  type: TransactionType;
  categories: {
    id: string;
    name: string;
    color: string | null;
    total: number;            // totale del periodo (per ordinamento)
    totals: number[];         // totale per mese (allineato a months)
  }[];
}

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type BudgetRollover = 'NONE' | 'SURPLUS' | 'FULL';
export type Frequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Budget {
  id: string;
  name: string;
  amount: number;
  categoryId?: string;
  period: BudgetPeriod;
  rollover: BudgetRollover;
  startDate: string;
  endDate?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  spent?: number;
  remaining?: number;
  percentage?: number;
  // Riporto dal/dai periodo/i precedente/i (può essere ±) e budget effettivo del
  // periodo corrente = amount + carryIn (valorizzati da getBudgets/getBudget)
  carryIn?: number;
  effectiveAmount?: number;
  // Finestra del periodo corrente (valorizzata da getBudgets/getBudget)
  periodStart?: string;
  periodEnd?: string;
  periodLabel?: string;
}

export interface BudgetHistoryPeriod {
  periodStart: string;
  periodEnd: string;
  label: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  exceeded: boolean;
}

export interface BudgetHistory {
  period: BudgetPeriod;
  history: BudgetHistoryPeriod[];
  stats: {
    avgSpent: number;
    adherenceRate: number;
    exceededCount: number;
    totalPeriods: number;
    bestPeriod: BudgetHistoryPeriod | null;
    worstPeriod: BudgetHistoryPeriod | null;
  };
}

export interface CreateBudgetDTO {
  name: string;
  amount: number;
  categoryId?: string;
  period: BudgetPeriod;
  rollover: BudgetRollover;
  startDate: string;
  endDate?: string;
}

// ── Budget automatico (suggerimenti) ──
export interface BudgetSuggestionItem {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  avgMonthly: number;
  suggestedCap: number;
  currentBudgetId: string | null;
  currentAmount: number | null;
}

export interface BudgetSuggestions {
  expectedIncome: number;
  fixedCommitments: number;
  cushion: number;
  // liquidity = saldo dei conti selezionati (niente proiezione); ccDueThisMonth = quota
  // di fixedCommitments dovuta all'addebito CC del mese. Per il mese prossimo
  // cushion − liquidity = proiezione dei flussi residui del mese corrente.
  liquidity: number;
  ccDueThisMonth: number;
  // Spese ricorrenti su carta del mese: non pesano sullo spendibile (vanno nell'addebito
  // di un ciclo futuro), esposte per avvisare l'utente.
  deferredCcMonthly: number;
  savingRate: number;
  savingTarget: number;
  spendable: number;
  monthOffset: number;
  perCategory: BudgetSuggestionItem[];
}

export interface RecurringTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  accountId?: string | null;
  frequency: Frequency;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  lastExecutedDate?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  account?: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
}

export interface RecurringDueItem extends RecurringTransaction {
  nextDueDate: string;
  daysOverdue: number;
}

export interface RecurringDueResponse {
  dueToday: RecurringDueItem[];
  overdue: RecurringDueItem[];
}

export interface ExecuteRecurringResult {
  created: Transaction[];
  count: number;
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
  accountId?: string;
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
  accountId?: string | null;
  plannedDate: string;
  isPaid: boolean;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  account?: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
}

export interface CreatePlannedTransactionDTO {
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  plannedDate: string;
  notes?: string;
  accountId?: string;
}

//Alert Interface

type AlertType = 'success' | 'info' | 'warning' | 'error' | ''

export interface AlertPopUp{
  tipo: AlertType;
  messaggio: string;
  checked: boolean;
}

// Account types
export type AccountType = 'BANK' | 'CREDIT_CARD';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  color: string;
  icon?: string;
  isDefault: boolean;
  openingBalance: number;
  creditLimit?: number | null;
  billingDay?: number | null;
  closingDay?: number | null;
  linkedAccountId?: string | null;
  linkedAccount?: { id: string; name: string } | null;
  linkedCC?: { id: string; name: string; color: string }[];
  balance: number;
  createdAt: string;
  updatedAt: string;
  _count?: { transactions: number };
}

export interface BillingCycle {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  billingDate: string | null;
  debtAmount: number;
  planned: {
    id: string;
    amount: number;
    isPaid: boolean;
    plannedDate: string;
  } | null;
}

export interface CreateAccountDTO {
  name: string;
  type: AccountType;
  color?: string;
  icon?: string;
  openingBalance?: number;
  creditLimit?: number;
  billingDay?: number;
  closingDay?: number;
  linkedAccountId?: string;
}

export interface UpdateAccountDTO {
  name?: string;
  color?: string;
  icon?: string;
  openingBalance?: number;
  creditLimit?: number | null;
  billingDay?: number | null;
  closingDay?: number | null;
  linkedAccountId?: string | null;
}

// Analytics

export interface ForecastHabitualCategory {
  categoryId?: string;
  categoryName: string;
  avgMonthly: number;
  alreadySpent: number;
  estimated: number;
}

export interface ForecastFrequentExpense {
  categoryId?: string;
  categoryName: string;
  icon?: string | null;
  color?: string | null;
  count: number;
  perMonth: number;
  avgMonthly: number;
}

export interface Forecast {
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  currentBalance: number;
  currentMonthActual: { income: number; expenses: number };
  dailyPace: { income: number; expenses: number };
  knownRemaining: { income: number; expenses: number };
  historicalAvg: { income: number; expenses: number; monthsConsidered: number };
  habitualRemaining: {
    total: number;
    hasData: boolean;
    categories: ForecastHabitualCategory[];
  };
  frequentExpenses: ForecastFrequentExpense[];
  projectedEndBalance: number;
}