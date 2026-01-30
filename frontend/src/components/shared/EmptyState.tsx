import { Plus } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon?: React.ReactNode;
}

/**
 * Componente riutilizzabile per stati vuoti
 * Usato quando non ci sono dati da visualizzare
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="empty-state-card">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-description">{description}</p>
      <button onClick={onAction} className="btn btn-primary btn-md">
        <Plus className="icon-md" />
        {actionLabel}
      </button>
    </div>
  );
}
