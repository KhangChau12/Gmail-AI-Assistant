'use client';

import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { catColor } from '@/lib/categories';
import { initials, senderHue } from '@/lib/format';
import type { CategoryColor } from '@/lib/types';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={clsx('kbd', className)}>{children}</kbd>;
}

/** Initials on a tint: the email's category colour when known, otherwise a stable hue per sender. */
export function Avatar({ name, address, size = 28, color }: { name: string; address: string; size?: number; color?: CategoryColor }) {
  const hue = senderHue(address);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: color ? catColor(color, 0.2) : `hsl(${hue} 45% 55% / 0.18)`,
        color: color ? catColor(color) : `hsl(${hue} 50% 58%)`,
      }}
    >
      {initials(name, address)}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={clsx('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('size-3.5 animate-spin', className)} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  shortcut?: string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={shortcut ? `${label}  ${shortcut}` : label}
      className={clsx(
        'inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-40',
        active && 'text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

/** Centered overlay used by the composer, command palette and settings. Closes on Escape / backdrop click. */
export function Modal({
  onClose,
  children,
  className,
  align = 'center',
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: 'center' | 'top';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className={clsx(
        'fixed inset-0 z-40 flex justify-center bg-black/40 px-4 backdrop-blur-[2px] animate-fade-in',
        align === 'top' ? 'items-start pt-[12vh]' : 'items-center',
      )}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal className={clsx('rounded-xl bg-elevated shadow-pop animate-pop-in', className)}>
        {children}
      </div>
    </div>
  );
}

export interface ToastState {
  id: number;
  message: string;
  tone?: 'default' | 'error';
}

export function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center">
      <div
        key={toast.id}
        className={clsx(
          'rounded-xl border border-line-strong bg-elevated px-3.5 py-2 text-sm shadow-pop animate-pop-in',
          toast.tone === 'error' ? 'text-danger' : 'text-fg',
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
