import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

interface ToastOptions {
  id?: string;
  duration?: number;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const removeToast = useCallback((id: string) => {
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback((id?: string) => {
    if (id) {
      removeToast(id);
    } else {
      setToasts([]);
    }
  }, [removeToast]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 3500, options?: ToastOptions): string => {
      const id = options?.id || Math.random().toString(36).substring(2, 9);

      if (timeoutsRef.current[id]) {
        clearTimeout(timeoutsRef.current[id]);
        delete timeoutsRef.current[id];
      }

      setToasts((prev) => {
        const existingIndex = prev.findIndex((t) => t.id === id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { id, type, message, duration };
          return updated;
        }
        return [...prev, { id, type, message, duration }];
      });

      // If duration is > 0 and not loading (or custom duration given), auto-dismiss
      if (type !== 'loading' && duration > 0) {
        timeoutsRef.current[id] = setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback((msg: string, options?: ToastOptions) => showToast(msg, 'success', options?.duration ?? 3500, options), [showToast]);
  const error = useCallback((msg: string, options?: ToastOptions) => showToast(msg, 'error', options?.duration ?? 4500, options), [showToast]);
  const info = useCallback((msg: string, options?: ToastOptions) => showToast(msg, 'info', options?.duration ?? 3500, options), [showToast]);
  const warning = useCallback((msg: string, options?: ToastOptions) => showToast(msg, 'warning', options?.duration ?? 3500, options), [showToast]);
  const loading = useCallback((msg: string, options?: ToastOptions) => showToast(msg, 'loading', 0, options), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, loading, dismiss }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all ${
                toast.type === 'success'
                  ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : toast.type === 'error'
                  ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                  : toast.type === 'warning'
                  ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                  : toast.type === 'loading'
                  ? 'bg-slate-900/95 dark:bg-slate-800/95 border-slate-700 text-white shadow-xl'
                  : 'bg-slate-900/90 dark:bg-slate-800/95 border-slate-700 text-white'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                {toast.type === 'loading' && <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400" />}
              </div>
              <p className="text-sm font-medium leading-snug flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

