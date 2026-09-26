import { useState } from 'react';
import { TrendingUp, TrendingDown, CreditCard, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import BaseModal from '../layout/ModalBase';
import { useExecuteRecurring } from '../../hooks/useRecurringTransactions';
import { useMarkAsPaid } from '../../hooks/usePlannedTransactions';
import { usePayInstallments } from '../../hooks/useInstallmentPlans';
import { useToast } from '../../contexts/ToastContext';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { formatDayMonth } from '../../utils/date';
import { DUE_GROUPS, groupInstallments, type DueEntry } from './dueEntries';

interface DueTodayModalProps {
  entries: DueEntry[];
  /** "Salta oggi" o registrazione completata: chiude il popup per la giornata. */
  onDismiss: () => void;
}

export default function DueTodayModal({ entries, onDismiss }: DueTodayModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map((e) => e.key)));
  // Data effettiva scelta dall'utente (solo se diversa da quella prevista).
  const [dates, setDates] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const executeRecurring = useExecuteRecurring();
  const markAsPaid = useMarkAsPaid();
  const payInstallments = usePayInstallments();
  const toast = useToast();
  const { formatSignedCurrency } = useFormatCurrency();

  const today = format(new Date(), 'yyyy-MM-dd');
  const dateOf = (e: DueEntry) => dates[e.key] ?? e.scheduledDate;
  // Un refetch a popup aperto può togliere voci già registrate altrove.
  const chosen = entries.filter((e) => selected.has(e.key));

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
      } catch {
        failed += recurring.length;
      }
    }

    // Pianificate e addebiti carta: data prevista (o quella corretta), non "oggi".
    for (const e of chosen.filter((x) => x.kind === 'planned' || x.kind === 'cc')) {
      try {
        await markAsPaid.mutateAsync({ id: e.id, date: dateOf(e) });
        done += 1;
      } catch {
        failed += 1;
      }
    }

    for (const g of groupInstallments(chosen, dateOf)) {
      try {
        await payInstallments.mutateAsync({ plannedIds: g.ids, date: g.date });
        done += g.ids.length;
      } catch {
        failed += g.ids.length;
      }
    }

    setSubmitting(false);
    if (failed === 0) {
      toast.success(`${done} moviment${done === 1 ? 'o registrato' : 'i registrati'}`);
      onDismiss();
    } else {
      // Il popup resta aperto: le voci registrate spariscono al refetch, le altre si possono riprovare.
      toast.error(`${failed} moviment${failed === 1 ? 'o non registrato' : 'i non registrati'}: riprova`);
    }
  };

  const dateLabel = (e: DueEntry) => {
    if (dates[e.key]) return formatDayMonth(dates[e.key]);
    if (e.daysOverdue > 0) return `⚠ ${e.daysOverdue}g fa`;
    return 'oggi';
  };

  return (
    <BaseModal isOpen title="Scadenze da registrare" onClose={onDismiss}>
      <div className="due-modal">
        <p className="due-modal-intro">
          Questi movimenti erano in programma. Se sono già avvenuti (es. addebito diretto sul
          conto) registrali qui, senza inserirli a mano. Se un pagamento è arrivato in un altro
          giorno, tocca la data per correggerla.
        </p>

        <div className="due-modal-list">
          {DUE_GROUPS.map(({ kind, label }) => {
            const items = entries.filter((e) => e.kind === kind);
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
                            <button
                              type="button"
                              className={`due-date-chip${!dates[e.key] ? ' is-active' : ''}`}
                              onClick={() => setDate(e, e.scheduledDate)}
                            >
                              Prevista · {formatDayMonth(e.scheduledDate)}
                            </button>
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
            Salta oggi
          </button>
          <button
            type="button"
            onClick={handleRegister}
            disabled={chosen.length === 0 || submitting}
            className="btn btn-primary btn-md"
          >
            {submitting ? 'Registrazione...' : `Registra (${chosen.length})`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
