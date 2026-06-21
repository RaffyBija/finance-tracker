import { Plus, Info } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  /** Testo informativo a bassa priorità, mostrato come tooltip su un'icona accanto al titolo. */
  info?: string;
}

/**
 * Header standard per le pagine con titolo e azione opzionale.
 * Su mobile: titolo + bottone si impilano verticalmente.
 */
export default function PageHeader({
  title,
  actionLabel = 'Nuovo',
  onAction,
  subtitle,
  info,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <div className="page-header-titlerow">
          <h1 className="page-header-title">{title}</h1>
          {info && (
            <button type="button" className="page-header-info" title={info} aria-label={info}>
              <Info className="icon-sm" />
            </button>
          )}
        </div>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {onAction && (
        <button onClick={onAction} className="btn btn-primary btn-md page-header-btn">
          <Plus className="icon-md" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}