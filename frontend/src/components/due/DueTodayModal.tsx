import { useState } from 'react';
import { TrendingUp, TrendingDown, CreditCard, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import BaseModal from '../layout/ModalBase';
import { useExecuteRecurring } from '../../hooks/useRecurringTransactions';
import { useMarkAsPaid } from '../../hooks/usePlannedTransactions';
import { usePayInstallments } from '../../hooks/useInstallmentPlans';
import { useToast } from '../../contexts/ToastContext';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useAccounts, useDefaultAccount } from '../../hooks/useAccounts';
import AccountSelector from '../accounts/AccountSelector';
import { formatDayMonth } from '../../utils/date';
import { DUE_GROUPS, RECENT_DAYS, groupInstallments, type DueEntry } from './dueEntries';

interface DueTodayModalProps {
  entries: DueEntry[];
  /** "Salta oggi" o registrazione completata: chiude il popup per la giornata. */
  onDismiss: () => void;
  /** Aperto a mano da un banner: il secondario è "Chiudi", non "Salta oggi". */
  manual?: boolean;
  /** Voci scelte esplicitamente (click su una card): tutte preselezionate. */
  preselectAll?: boolean;
}

export default function DueTodayModal({ entries, onDismiss, manual = false, preselectAll = false }: DueTodayModalProps) {
  // Preselezionate solo le scadenze recenti: gli arretrati vecchi vanno spuntati a
  // mano, così un "Registra" distratto non registra movimenti forse mai avvenuti.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(entries.filter((e) => preselectAll || e.daysOverdue <= RECENT_DAYS).map((e) => e.key)),
  );
  // Data effettiva scelta dall'utente (solo se diversa da quella prevista).
  const [dates, setDates] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Conto scelto per le rate dei piani a pagamento manuale (default: conto principale).
  const [chosenAccounts, setChosenAccounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const executeRecurring = useExecuteRecurring();
  const markAsPaid = useMarkAsPaid();
  const payInstallments = usePayInstallments();
  const toast = useToast();
  const { formatSignedCurrency } = useFormatCurrency();
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();

  const today = format(new Date(), 'yyyy-MM-dd');
  const dateOf = (e: DueEntry) => dates[e.key] ?? e.scheduledDate;
  const accountOf = (e: DueEntry) =>
    e.needsAccount ? chosenAccounts[e.key] ?? defaultAccount?.id ?? accounts[0]?.id : undefined;
  // Voci già registrate in questo popup: escluse da lista e invio anche quando le
  // voci sono uno snapshot (click su card) che il refetch non aggiorna. Così, dopo
  // un errore parziale, "Registra" riprova solo ciò che è davvero fallito.
  const [registered, setRegistered] = useState<Set<string>>(() => new Set());
  const visible = entries.filter((e) => !registered.has(e.key));
  // Un refetch a popup aperto può togliere voci già registrate altrove.
  const chosen = visible.filter((e) => selected.has(e.key));

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const setDate = (e: DueEntry, value: string) => {
    setDates((prev) => {
      const next = { ...prev };
      if (!value || value === e.scheduledDate) delete next[e.key];
      else next[e.key] = value;
      return next;
    });
  };

  const handleRegister = async () => {
    setSubmitting(true);
    let done = 0;
    let failed = 0;
    const ok: string[] = [];

    const recurring = chosen.filter((e) => e.kind === 'recurring');
    if (recurring.length > 0) {
      const overrides = Object.fromEntries(
        recurring.filter((e) => dates[e.key]).map((e) => [e.id, dates[e.key]]),
      );
      try {
        const result = await executeRecurring.mutateAsync({
          ids: recurring.map((e) => e.id),
          dates: Object.keys(overrides).length > 0 ? overrides : undefined,
        });
        // count reale: il backend salta una ricorrente senza scadenza calcolabile.
        done += result.count;
        ok.push(...recurring.map((e) => e.key));
      } catch {
        failed += recurring.length;
      }
    }

    // Pianificate e addebiti carta: data prevista (o quella corretta), non "oggi".
    for (const e of chosen.filter((x) => x.kind === 'planned' || x.kind === 'cc')) {
      try {
        await markAsPaid.mutateAsync({ id: e.id, date: dateOf(e) });
        done += 1;
        ok.push(e.key);
      } catch {
        failed += 1;
      }
    }

    for (const g of groupInstallments(chosen, dateOf, accountOf)) {
      try {
        await payInstallments.mutateAsync({ plannedIds: g.ids, date: g.date, accountId: g.accountId });
        done += g.ids.length;
        ok.push(...g.ids.map((id) => `i:${id}`));
      } catch {
        failed += g.ids.length;
      }
    }

    setSubmitting(false);
    setRegistered((prev) => new Set([...prev, ...ok]));
    if (failed === 0) {
      toast.success(`${done} moviment${done === 1 ? 'o registrato' : 'i registrati'}`);
      onDismiss();
    } else {
      // Il popup resta aperto: le voci registrate spariscono, le altre si possono riprovare.
      toast.error(`${failed} moviment${failed === 1 ? 'o non registrato' : 'i non registrati'}: riprova`);
    }
  };

  const dateLabel = (e: DueEntry) => {
    if (dates[e.key]) return formatDayMonth(dates[e.key]);
    if (e.daysOverdue > 0 && !e.undated) return `⚠ ${e.daysOverdue}g fa`;
    if (e.daysOverdue === 0) return 'oggi';
    return formatDayMonth(e.scheduledDate); // scadenza futura: registrazione anticipata
  };

  return (
    <BaseModal isOpen title="Scadenze da registrare" onClose={onDismiss}>
      <div className="due-modal">
        <p className="due-modal-intro">
          Questi movimenti erano in programma. Se sono già avvenuti (es. addebito diretto sul
          conto) registrali qui, senza inserirli a mano. Se un pagamento è arrivato in un altro
          giorno, tocca la data per correggerla.
          {visible.some((e) => e.daysOverdue > RECENT_DAYS) && (
            <> Le scadenze più vecchie di una settimana non sono selezionate: spuntale solo se le hai pagate.</>
          )}
        </p>

        <div className="due-modal-list">
          {DUE_GROUPS.map(({ kind, label }) => {
            const items = visible.filter((e) => e.kind === kind);
            if (items.length === 0) return null;
            return (
              <section key={kind} className="due-group">
                <h3 className="due-group-title">{label}</h3>
                {items.map((e) => {
                  const isSelected = selected.has(e.key);
                  const isEditing = editingKey === e.key;
                  const isIncome = e.type === 'INCOME';
                  return (
                    <div key={e.key} className="due-entry">
                      <div
                        className={`due-item${isSelected ? ' is-selected' : ''}`}
                        onClick={() => toggle(e.key)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(e.key)}
                          onClick={(ev) => ev.stopPropagation()}
                          className="due-item-checkbox"
                          aria-label={`Registra ${e.title}`}
                        />
                        <div className={isIncome ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
                          {e.kind === 'cc'
                            ? <CreditCard className="icon-sm" />
                            : isIncome ? <TrendingUp className="icon-sm" /> : <TrendingDown className="icon-sm" />}
                        </div>
                        <div className="due-item-info">
                          <p className="due-item-name">{e.title}</p>
                          <p className="due-item-sub">{e.subtitle}</p>
                        </div>
                        <div className="due-item-right">
                          <span className={isIncome ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
                            {formatSignedCurrency(e.amount, e.type)}
                          </span>
                          <button
                            type="button"
                            className={`due-item-date${dates[e.key] ? ' is-custom' : e.daysOverdue > 0 ? ' is-overdue' : ''}`}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setEditingKey(isEditing ? null : e.key);
                            }}
                            aria-expanded={isEditing}
                            aria-label={`Data di registrazione: ${formatDayMonth(dateOf(e))}. Modifica`}
                          >
                            {dateLabel(e)}
                            <Pencil className="due-item-date-icon" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {e.needsAccount && isSelected && accounts.length > 1 && (
                        <div className="due-account-row" onClick={(ev) => ev.stopPropagation()}>
                          <AccountSelector
                            accounts={accounts}
                            value={accountOf(e) ?? ''}
                            onChange={(id) => setChosenAccounts((prev) => ({ ...prev, [e.key]: id }))}
                            label={e.type === 'INCOME' ? 'Incassato su' : 'Pagato da'}
                          />
                        </div>
                      )}

                      {isEditing && (
                        <div className="due-date-editor">
                          <label className="due-date-editor-label" htmlFor={`due-date-${e.key}`}>
                            Data effettiva
                          </label>
                          <input
                            id={`due-date-${e.key}`}
                            type="date"
                            className="form-input due-date-editor-input"
                            value={dateOf(e)}
                            onChange={(ev) => setDate(e, ev.target.value)}
                          />
                          <div className="due-date-editor-chips">
                            {!e.undated && (
                              <button
                                type="button"
                                className={`due-date-chip${!dates[e.key] ? ' is-active' : ''}`}
                                onClick={() => setDate(e, e.scheduledDate)}
                              >
                                Prevista · {formatDayMonth(e.scheduledDate)}
                              </button>
                            )}
                            {e.scheduledDate !== today && (
                              <button
                                type="button"
                                className={`due-date-chip${dates[e.key] === today ? ' is-active' : ''}`}
                                onClick={() => setDate(e, today)}
                              >
                                Oggi
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <div className="form-actions">
          <button type="button" onClick={onDismiss} className="btn btn-ghost btn-md" disabled={submitting}>
            {manual ? 'Chiudi' : 'Salta oggi'}
          </button>
          <button
            type="button"
            onClick={handleRegister}
            disabled={chosen.length === 0 || submitting || chosen.some((e) => e.needsAccount && !accountOf(e))}
            className="btn btn-primary btn-md"
          >
            {submitting ? 'Registrazione...' : `Registra (${chosen.length})`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
