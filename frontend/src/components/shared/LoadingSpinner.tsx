interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Spinner di caricamento riutilizzabile
 */
export default function LoadingSpinner({
  message = 'Caricamento...',
  size = 'md',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-32',
    md: 'h-64',
    lg: 'h-96',
  };

  return (
    <div className={`flex-center ${sizeClasses[size]}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-neutral-600">{message}</p>
      </div>
    </div>
  );
}
