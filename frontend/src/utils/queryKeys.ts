// Cache che dipendono da spesa variabile, impegni, conti, categorie e periodo di paga:
// vanno invalidate da ogni mutation che le tocca (transazioni, ricorrenti, pianificate,
// rate, conti, categorie, profilo). Le chiavi sotto ['dashboard'] (es. pay-period)
// sono già coperte dall'invalidazione di 'dashboard'.
export const BUDGET_RELATED = ['budgets', 'budget-history', 'budget-suggestions'];

/** Unisce liste di chiavi senza duplicati. */
export const withBudgetKeys = (keys: string[]): string[] =>
  Array.from(new Set([...keys, ...BUDGET_RELATED]));
