import { Plus } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
}

/**
 * Header standard per le pagine con titolo e azione opzionale
 */
export default function PageHeader({
  title,
  actionLabel = 'Nuovo',
  onAction,
  subtitle,
}: PageHeaderProps) {
  return (
    <div className="flex-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
        {subtitle && <p className="text-neutral-600 mt-1">{subtitle}</p>}
      </div>
      {onAction && (
        <button onClick={onAction} className="btn btn-primary btn-md">
          <Plus className="icon-md" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
