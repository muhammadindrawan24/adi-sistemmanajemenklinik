'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

function ToastProvider({ children, position = 'top-right' }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    },
    []
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className={cn('fixed z-[100] flex flex-col gap-2', positionClasses[position])}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const typeConfig = {
    success: {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      bg: 'bg-green-50 border-green-200',
      border: 'border-l-4 border-l-green-500',
    },
    error: {
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      bg: 'bg-red-50 border-red-200',
      border: 'border-l-4 border-l-red-500',
    },
    warning: {
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      bg: 'bg-amber-50 border-amber-200',
      border: 'border-l-4 border-l-amber-500',
    },
    info: {
      icon: <Info className="h-5 w-5 text-blue-500" />,
      bg: 'bg-blue-50 border-blue-200',
      border: 'border-l-4 border-l-blue-500',
    },
    default: {
      icon: <Info className="h-5 w-5 text-slate-500" />,
      bg: 'bg-slate-50 border-slate-200',
      border: 'border-l-4 border-l-slate-500',
    },
  };

  const config = typeConfig[toast.type];

  return (
    <div
      className={cn(
        'w-80 rounded-xl border-2 bg-white shadow-lg transition-all duration-300',
        'transform',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        config.border
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 pt-0.5">{config.icon}</div>
          <div className="flex-1">
            {toast.title && (
              <h3 className="text-sm font-semibold text-slate-900">{toast.title}</h3>
            )}
            {toast.description && (
              <p className="mt-1 text-sm text-slate-600">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { ToastProvider, ToastItem };