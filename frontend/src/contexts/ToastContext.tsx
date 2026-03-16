import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value: ToastContextValue = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info:    (msg) => addToast(msg, 'info'),
  };

  const icons: Record<ToastType, string> = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  };

  const colors: Record<ToastType, string> = {
    success: 'bg-success-50 border-success-200 text-success-800',
    error:   'bg-danger-50 border-danger-200 text-danger-800',
    warning: 'bg-warning-50 border-warning-200 text-warning-800',
    info:    'bg-primary-50 border-primary-200 text-primary-800',
  };

  const iconColors: Record<ToastType, string> = {
    success: 'text-success-600',
    error:   'text-danger-600',
    warning: 'text-warning-600',
    info:    'text-primary-600',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* ── Contenitore toast — bottom right ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
              pointer-events-auto min-w-[280px] max-w-[360px]
              animate-in slide-in-from-bottom-4 fade-in duration-300
              ${colors[toast.type]}
            `}
          >
            <span className={`font-bold text-base leading-tight flex-shrink-0 ${iconColors[toast.type]}`}>
              {icons[toast.type]}
            </span>
            <span className="text-sm leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve essere usato dentro ToastProvider');
  return ctx;
}