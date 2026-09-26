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
  // Periodo di paga: categoria degli accrediti stipendio + giorno di riferimento
  salaryCategoryId?: string | null;
  payDay?: number | null;
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
  // Solo con il ritmo quotidiano attivo (punti proiettati):
  rhythm?: number;    // saldo con la spesa variabile stimata
  bandLow?: number;   // con il ritmo più alto dei periodi di confronto
  bandHigh?: number;  // con il ritmo più basso
}

// ── Periodo di paga (stipendio → stipendio) ──
export type PayPeriodSource = 'planned' | 'recurring' | 'payday' | 'calendar';

export interface PayPeriod {
  configured: boolean;
  source: PayPeriodSource;
  start: string;       // YYYY-MM-DD, inizio del periodo corrente
  nextPayday: string;  // YYYY-MM-DD, prossimo accredito atteso
  daysElapsed: number;
  daysTotal: number;
  daysToPayday: number;
}

// ── Ritmo quotidiano (spesa variabile stimata) ──
export interface RhythmPeriodStat {
  start: string;
  end: string;   // escluso
  days: number;
  spent: number;
  rate: number;
}

export interface RhythmCategory {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  daily: number;
  share: number;
}

export interface SpendingRhythmStats {
  basis: 'periods' | 'current' | 'none';
  dailyRate: number;
  low: number;
  high: number;
  periods: RhythmPeriodStat[];
  current: { start: string; days: number; spent: number; rate: number };
  topCategories: RhythmCategory[];
}

export interface ProjectionRhythm extends SpendingRhythmStats {
  appliedRate: number;
  override: boolean;
  scopeDaily: number;
  totalEstimated: number;
  projectedBalance: number;
  projectedLow: number;
  projectedHigh: number;
}

export interface ProjectionEvent {
  date: string;       // YYYY-MM-DD
  label: string;
  amount: number;
  type: TransactionType;
  source: 'recurring' | 'planned' | 'cc' | 'sospeso';
}

export interface ProjectionSeriesParams {
  months?: number;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  historyDays?: number;
  includeSuspended?: boolean;
  horizon?: 'payday';     // fino al prossimo accredito (ignora months/date)
  rhythm?: boolean;       // aggiunge la linea col ritmo quotidiano
  rhythmRate?: number;    // override manuale del ritmo (€/giorno)
}

export interface ProjectionSeries {
  currentBalance: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedBalance: number;
  recurringCount: number;
  plannedCount: number;
  suspendedCount: number;
  points: ProjectionPoint[];
  events: ProjectionEvent[];
  payPeriod: PayPeriod;
  rhythm: ProjectionRhythm | null;
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

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'PAY_PERIOD';
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

// ── Budget automatico (proposte intelligenti) ──
export interface BudgetSuggestionItem {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  avgPerPeriod: number;          // media della spesa VARIABILE per periodo
  suggestedCap: number;
  currentBudgetId: string | null;
  currentAmount: number | null;
  currentPeriod: BudgetPeriod | null;
}

export interface BudgetPlanFlows {
  income: number;
  fixed: number;
  variable: number;
}

// Piano del periodo (per competenza, vedi backend utils/budgetPlan.ts).
export interface BudgetSuggestions {
  mode: 'pay' | 'month';
  payPeriodConfigured: boolean;
  budgetPeriod: 'PAY_PERIOD' | 'MONTHLY';
  offset: 0 | 1;
  window: { start: string; end: string; label: string; days: number; elapsedDays: number };
  liquidity: number;          // liquidità dei conti del perimetro, oggi
  ccDebt: number;             // debito carte del perimetro (ciclo aperto + addebiti da registrare)
  netNow: number;             // liquidity − ccDebt
  netStart: number;           // disponibilità netta a inizio periodo
  expectedIncome: number;     // entrate dell'intero periodo
  fixedCommitments: number;   // fisse + programmate dell'intero periodo
  disposable: number;         // netStart + entrate − impegni
  variableSpent: number;      // spesa variabile già fatta nel periodo in corso
  actual: BudgetPlanFlows | null;
  gap: BudgetPlanFlows | null;
  savingRate: number;
  savingTarget: number;
  spendable: number;
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
  plannedDate: string | null;   // null = "Sospeso": importo noto, data ignota
  isPaid: boolean;
  notes?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  account?: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
  // Rata di un piano a rate (InstallmentPlan): valorizzati quando la pianificata
  // è una scadenza di un debito/credito dilazionato.
  planId?: string | null;
  counterparty?: string | null;
  // Pianificata di addebito di un ciclo CC: id della carta da saldare.
  ccAccountId?: string | null;
}

export interface CreatePlannedTransactionDTO {
  amount: number;
  type: TransactionType;
  description: string;
  categoryId?: string;
  plannedDate?: string;   // assente = Sospeso
  notes?: string;
  accountId?: string;
}

// ── Scadenzario: piani a rate (debiti/crediti dilazionati) ────────────────────

export type PlanDirection = 'DEBT' | 'CREDIT';
export type InstallmentPlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

// La singola rata è una PlannedTransaction (con planId/counterparty valorizzati).
export type InstallmentRata = PlannedTransaction;

export interface InstallmentPlanProgress {
  totalCount: number;
  paidCount: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string | null;
}

export interface InstallmentPlan {
  id: string;
  userId: string;
  direction: PlanDirection;
  title: string;
  totalAmount: number;
  notes?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  ccAccountId?: string | null;
  status: InstallmentPlanStatus;
  createdAt: string;
  updatedAt: string;
  installments: InstallmentRata[];
  category?: Category | null;
  account?: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
  ccAccount?: Pick<Account, 'id' | 'name' | 'color' | 'type'> | null;
  progress: InstallmentPlanProgress;
}

// Rata in scadenza restituita da GET /installments/due: porta con sé il piano
// di appartenenza (per titolo/direzione). Alimenta PendingContext e i badge.
export interface InstallmentDueRata extends PlannedTransaction {
  plan: Pick<InstallmentPlan, 'id' | 'title' | 'direction' | 'accountId'>;
}

export interface InstallmentInput {
  amount: number;
  plannedDate: string;
  counterparty?: string | null;
  notes?: string | null;
}

export interface CreateInstallmentPlanDTO {
  direction: PlanDirection;
  title: string;
  notes?: string;
  categoryId?: string;
  accountId?: string;
  installments: InstallmentInput[];
}

export interface UpdateInstallmentPlanDTO {
  title?: string;
  notes?: string;
  categoryId?: string;
  accountId?: string;
  installments?: InstallmentInput[];
}

export interface PayInstallmentsDTO {
  plannedIds: string[];
  accountId?: string;
  date?: string;
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
  archivedAt?: string | null; // conto archiviato (solo con includeArchived)
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

// Stima fino al prossimo stipendio (card dashboard "Stima realistica").
export interface ForecastLowPoint {
  value: number;
  date: string;
}

export interface ForecastAccountLow {
  id: string;
  name: string;
  color: string | null;
  balance: number;
  standardMin: ForecastLowPoint | null;
  rhythmMin: ForecastLowPoint | null;
}

export interface Forecast {
  payPeriod: PayPeriod;
  eveDate: string;         // giorno prima dell'accredito
  daysRemaining: number;   // giorni da domani alla vigilia inclusa
  currentBalance: number;
  known: { income: number; expenses: number };
  rhythm: SpendingRhythmStats & { remaining: number };
  atEve: { standard: number; withRhythm: number; low: number; high: number };
  lowest: { standard: ForecastLowPoint | null; withRhythm: ForecastLowPoint | null };
  spendablePerDay: number | null;
  accounts: ForecastAccountLow[];
}

// ── Analisi spese (sezione Analisi) ──
export type ExpenseKind = 'fixed' | 'planned' | 'variable';

export interface AnalysisPeriod {
  start: string;       // YYYY-MM-DD incluso
  end: string;         // YYYY-MM-DD escluso
  days: number;
  elapsedDays: number; // = days per i periodi chiusi
  isCurrent: boolean;
}

export interface SpendingLine {
  date: string;
  amount: number;
  categoryId: string | null;
  kind: ExpenseKind;
  accountId: string | null;
  description: string | null;
  txId: string;
}

export interface SpendingAnalysis {
  mode: 'pay' | 'month';
  payPeriodConfigured: boolean;
  today: string;
  periods: AnalysisPeriod[];
  income: number[];           // per periodo
  knownRemaining: number;     // impegni attesi nel periodo in corso
  lines: SpendingLine[];
  categories: { id: string; name: string; color: string | null; icon: string | null }[];
  accounts: { id: string; name: string; color: string; type: AccountType; archived: boolean }[];
}

export interface NetWorthPlan {
  id: string;
  title: string;
  remaining: number;
  count: number;
  nextDate: string | null;
}

export interface NetWorthNow {
  liquidity: number;
  credits: number;
  suspendedIn: number;
  ccDebt: number;
  debts: number;
  suspendedOut: number;
  netWorth: number;
  debtPlans: NetWorthPlan[];
  creditPlans: NetWorthPlan[];
}

