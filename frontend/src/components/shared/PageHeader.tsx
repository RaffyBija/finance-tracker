import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
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
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
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