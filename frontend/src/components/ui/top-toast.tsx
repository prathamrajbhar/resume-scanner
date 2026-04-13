'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info' | 'welcome';

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ShowToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type TopToastContextValue = {
  showToast: (input: ShowToastInput) => void;
};

const TopToastContext = createContext<TopToastContextValue | null>(null);

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  welcome: 'border-slate-700 bg-slate-900 text-slate-100 shadow-[0_18px_35px_-18px_rgba(15,23,42,0.9)]',
};

export function TopToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(({ message, tone = 'info', durationMs = 2400 }: ShowToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);

    setToasts((prev) => [...prev, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <TopToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed left-1/2 top-5 z-[9999] w-full max-w-xl -translate-x-1/2 px-4">
        <div className="space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`slide-down-in rounded-xl border px-5 py-3 text-sm font-medium shadow-lg ${toneClass[toast.tone]} ${toast.tone === 'welcome' ? 'toast-welcome-glow' : ''}`}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </TopToastContext.Provider>
  );
}

export function useTopToast() {
  const context = useContext(TopToastContext);
  if (!context) {
    throw new Error('useTopToast must be used within TopToastProvider');
  }

  return context;
}
