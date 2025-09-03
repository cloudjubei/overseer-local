import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

type ToastMessage = { id?: string; title?: string; description?: string; variant?: ToastVariant; durationMs?: number; action?: { label: string; onClick: () => void } };

type ToastCtx = { toast: (msg: ToastMessage) => void };

const Ctx = createContext<ToastCtx | null>(null);

type ToastItem = Required<ToastMessage> & { isClosing?: boolean };

function useToastsState() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idSeq = useRef(0);
  const closeTimers = useRef(new Map<string, number>());

  const remove = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = closeTimers.current.get(id);
    if (t) {
      clearTimeout(t);
      closeTimers.current.delete(id);
    }
  }, []);

  const startClose = useCallback((id: string, afterMs = 220) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, isClosing: true } : x)));
    // remove after the out animation
    const timeout = window.setTimeout(() => remove(id), afterMs);
    closeTimers.current.set(id, timeout);
  }, [remove]);

  const add = useCallback((msg: ToastMessage) => {
    const id = msg.id || String(++idSeq.current);
    const duration = msg.durationMs ?? 3500;
    const item: ToastItem = {
      id,
      title: msg.title ?? '',
      description: msg.description ?? '',
      variant: msg.variant ?? 'default',
      durationMs: duration,
      action: msg.action ?? ({ label: '', onClick: () => {} } as any),
      isClosing: false,
    };
    setItems((xs) => [...xs, item]);
    if (duration > 0) {
      window.setTimeout(() => startClose(id), duration);
    }
  }, [startClose]);

  return { items, add, startClose, remove };
}

export function ToastView({ item, onClose }: { item: ToastItem; onClose: (id: string) => void }) {
  // Keep background solid to avoid transparency bleed.
  const variantAccent = (() => {
    switch (item.variant) {
      case 'success':
        return 'border-l-4 border-l-emerald-500';
      case 'error':
        return 'border-l-4 border-l-red-500';
      case 'warning':
        return 'border-l-4 border-l-amber-500';
      default:
        return 'border-l-4 border-l-gray-400 dark:border-l-gray-500';
    }
  })();

  const anim = item.isClosing
    ? 'animate-out fade-out-0 slide-out-to-top-2 duration-200 ease-in'
    : 'animate-in fade-in-50 slide-in-from-top-2 duration-200 ease-out';

  return (
    <div
      className={`pointer-events-auto w-[320px] overflow-hidden rounded-md border border-border bg-surface-raised text-text-primary shadow-lg ${variantAccent} ${anim}`}
      role="status"
      aria-live="polite"
    >
      <div className="p-2.5">
        {item.title ? <div className="text-sm font-medium">{item.title}</div> : null}
        {item.description ? <div className="mt-0.5 text-xs opacity-90">{item.description}</div> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          {item.action?.label ? (
            <button
              className="text-xs font-medium text-brand-600 hover:underline"
              onClick={() => {
                item.action?.onClick?.();
                onClose(item.id);
              }}
            >
              {item.action.label}
            </button>
          ) : (
            <span />
          )}
          <button
            className="rounded p-1 text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onClose(item.id)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastViewport({ items, onClose }: { items: ToastItem[]; onClose: (id: string) => void }) {
  return createPortal(
    <div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-[1100] flex flex-col items-center gap-2">
      {items.map((t) => (
        <ToastView key={t.id} item={t} onClose={onClose} />
      ))}
      <div className="sr-only" aria-live="polite" aria-atomic="true" />
    </div>,
    document.body
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { items, add, startClose } = useToastsState();
  const api = useMemo<ToastCtx>(() => ({ toast: add }), [add]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastViewport items={items} onClose={startClose} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) return { toast: () => {} };
  return v;
}
