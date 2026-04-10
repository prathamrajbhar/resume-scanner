'use client';

import { ReactNode, useEffect, useState } from 'react';
import { X } from 'lucide-react';

type AppModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function AppModal({ isOpen, onClose, title, children }: AppModalProps) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAnimateIn(false);
    const raf = window.requestAnimationFrame(() => setAnimateIn(true));

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-[500px] max-h-[90vh] overflow-y-auto p-6 transform transition-all duration-200 ${
          animateIn ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
