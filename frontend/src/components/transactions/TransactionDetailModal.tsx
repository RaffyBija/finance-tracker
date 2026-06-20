import { Pencil, Trash2 } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { formatDateLong } from '../../utils/date';
import type { Transaction } from '../../types';

interface TransactionDetailModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  // Azioni opzionali: se fornite, il modal mostra Elimina/Modifica (pagina
  // Transazioni). Nelle liste read-only (dashboard, conto) restano assenti e il
  // modal si chiude solo con la X dell'header.
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Dettaglio di una transazione (normale / trasferimento / divisa). Superficie
 *  unica di lettura e azione della pagina Transazioni: riga pulita → questo modal.
 *  Read-only di default; con onEdit/onDelete espone le azioni in fondo. */
export default function TransactionDetailModal({
  isOpen,
  transaction,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailModalProps) {
  const { formatCurrency, formatSignedCurrency } = useFormatCurrency();
  if (!isOpen || !transaction) return null;

  const isTransfer = !!transaction.transferId;
  const isSplit = (transaction.items?.length ?? 0) > 0;
  const hasActions = !!onEdit || !!onDelete;

  // Per un trasferimento: la gamba EXPENSE è l'origine, la INCOME la destinazione.
  const transferFrom = transaction.type === 'EXPENSE' ? transaction.account : transaction.transferPeer;
  const transferTo = transaction.type === 'EXPENSE' ? transaction.transferPeer : transaction.account;

  const title = isTransfer
    ? 'Trasferimento'
    : transaction.description || 'Transazione';

  return (
    <BaseModal isOpen={isOpen} title={title} onClose={onClose}>
      <div className="modal-form">
        <div className="split-modal-summary">
          <div className="split-modal-summary-item">
            <span className="split-modal-summary-label">Importo</span>
            {isTransfer ? (
              <span className="split-modal-summary-amount">
                {formatCurrency(Number(transaction.amount))}
              </span>
            ) : (
              <span className={`split-modal-summary-amount ${transaction.type === 'INCOME' ? 'is-income' : 'is-expense'}`}>
                {formatSignedCurrency(Number(transaction.amount), transaction.type)}
              </span>
            )}
          </div>

          <div className="split-modal-summary-item">
            <span className="split-modal-summary-label">Data</span>
            <span className="split-modal-summary-value">{formatDateLong(transaction.date)}</span>
          </div>

          {isTransfer ? (
            <>
              <div className="split-modal-summary-item">
                <span className="split-modal-summary-label">Da</span>
                <span className="split-modal-summary-value split-modal-account">
                  {transferFrom && (
                    <span className="split-modal-account-dot" style={{ backgroundColor: transferFrom.color }} />
                  )}
                  {transferFrom?.name ?? '—'}
                </span>
              </div>
              <div className="split-modal-summary-item">
                <span className="split-modal-summary-label">A</span>
                <span className="split-modal-summary-value split-modal-account">
                  {transferTo && (
                    <span className="split-modal-account-dot" style={{ backgroundColor: transferTo.color }} />
                  )}
                  {transferTo?.name ?? '—'}
                </span>
              </div>
            </>
          ) : (
            <>
              {!isSplit && (
                <div className="split-modal-summary-item">
                  <span className="split-modal-summary-label">Categoria</span>
                  <span className="split-modal-summary-value">
                    {transaction.category?.icon && <span aria-hidden="true">{transaction.category.icon} </span>}
                    {transaction.category?.name || 'Senza categoria'}
                  </span>
                </div>
              )}
              {transaction.account && (
                <div className="split-modal-summary-item">
                  <span className="split-modal-summary-label">Conto</span>
                  <span className="split-modal-summary-value split-modal-account">
                    <span className="split-modal-account-dot" style={{ backgroundColor: transaction.account.color }} />
                    {transaction.account.name}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {isSplit && (
          <ul className="split-modal-list">
            {transaction.items!.map((item) => (
              <li key={item.id ?? item.categoryId} className="split-modal-row">
                <span className="split-modal-cat">
                  {item.category?.icon && <span aria-hidden="true">{item.category.icon} </span>}
                  {item.category?.name || 'Senza categoria'}
                </span>
                <span className="split-modal-amount">{formatCurrency(Number(item.amount))}</span>
              </li>
            ))}
          </ul>
        )}

        {hasActions && (
          <div className="form-actions">
            {onDelete && (
              <button type="button" onClick={onDelete} className="btn btn-danger-outline btn-md">
                <Trash2 size={14} /> Elimina
              </button>
            )}
            {onEdit && (
              <button type="button" onClick={onEdit} className="btn btn-primary btn-md">
                <Pencil size={14} /> Modifica
              </button>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
