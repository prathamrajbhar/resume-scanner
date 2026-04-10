'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmIcon?: ReactNode;
};

const ANIMATION_MS = 200;

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  confirmIcon,
}: ConfirmModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      return;
    }

    if (isRendered) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, ANIMATION_MS);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusables = getFocusableElements(dialogRef.current);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [isRendered, onClose]);

  const dialogStateClasses = useMemo(() => {
    const base = 'rounded-xl shadow-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)]';
    if (isOpen && !isClosing) {
      return `${base} opacity-100 scale-100`;
    }

    return `${base} opacity-0 scale-95`;
  }, [isOpen, isClosing]);

  if (!isRendered) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 transition-opacity duration-200 ease-out ${
        isOpen && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className={`w-full max-w-[320px] ${dialogStateClasses} transform p-5 transition-all duration-200 ease-out`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-modal-title" className="text-base font-semibold text-[var(--app-text)]">
              {title}
            </h2>
            <p id="confirm-modal-message" className="mt-1 text-sm text-[var(--app-muted)]">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button ref={cancelButtonRef} type="button" variant="secondary" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} className="rounded-xl bg-[var(--app-danger)] text-white hover:opacity-95 focus-visible:ring-[var(--app-danger)]">
            {confirmIcon ?? <Trash2 className="h-4 w-4" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}