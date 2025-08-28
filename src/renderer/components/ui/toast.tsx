import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

type ToastMessage = { id?: string; title?: string; description?: string; variant?: ToastVariant; durationMs?: number; action?: { label: string; onClick: () => void } };

type ToastCtx = { toast: (msg: ToastMessage) => void };

const Ctx = createContext<ToastCtx | null>(null);

function useToastsState() {
  const [items, setItems] = useState<Required<ToastMessage>[]>([] as any);
  const idSeq = useRef(0);

  const remove = useCallback((id: string) => {
    setItems((xs) => xs.filter(x => x.id !== id));
  }, []);

  const add = useCallback((msg: ToastMessage) => {
    const id = msg.id || String(++idSeq.current);
    const duration = msg.durationMs ?? 3500;
    const item: Required<ToastMessage> = {
      id,
      title: msg.title ?? '',
      description: msg.description ?? '',
      variant: msg.variant ?? 'default',
      durationMs: duration,
      action: msg.action ?? ({ label: '', onClick: () => {} } as any),
    };
    setItems((xs) => [...xs, item]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);

  return { items, add, remove };
}

export function ToastView({ item, onClose }: { item: Required<ToastMessage>; onClose: (id: string) => void }) {
  const color = (() => {
    switch (item.variant) {
      case 'success':
        return 'bg-[color:var(--status-done-soft-bg)] text-[color:var(--status-done-soft-fg)] border-[color:var(--status-done-soft-border)]';
      case 'error':
        return 'bg-[color:var(--status-stuck-soft-bg)] text-[color:var(--status-stuck-soft-fg)] border-[color:var(--status-stuck-soft-border)]';
      case 'warning':
        return 'bg-[color:var(--status-working-soft-bg)] text-[color:var(--status-working-soft-fg)] border-[color:var(--status-working-soft-border)]';
      default:
        return 'bg-surface-raised text-text-primary border-border';
    }
  })();
  return (
    <div className={`pointer-events-auto w-[360px] overflow-hidden rounded-md border shadow-md ${color} animate-in fade-in-50 slide-in-from-top-2`}
         role="status" aria-live="polite">
      <div className="p-3">
        {item.title ? <div className="text-sm font-semibold">{item.title}</div> : null}
        {item.description ? <div className="mt-0.5 text-sm opacity-90">{item.description}</div> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          {item.action?.label ? (
            <button className="text-sm font-medium text-brand-600 hover:underline" onClick={() => { item.action?.onClick?.(); onClose(item.id); }}> {item.action.label} </button>
          ) : <span />}
          <button className="rounded p-1 text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => onClose(item.id)} aria-label="Close">×</button>
        </div>
      </div>
    </div>
  );
}

function ToastViewport({ items, onClose }: { items: Required<ToastMessage>[]; onClose: (id: string) => void }) {
  return createPortal(
    <div className="pointer-events-none fixed top-4 right-4 z-[1100] flex flex-col gap-2">
      {items.map((t) => (
        <ToastView key={t.id} item={t} onClose={onClose} />
      ))}
      <div className="sr-only" aria-live="polite" aria-atomic="true" />
    </div>,
    document.body
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { items, add, remove } = useToastsState();
  const api = useMemo<ToastCtx>(() => ({ toast: add }), [add]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastViewport items={items} onClose={remove} />
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) return { toast: () => {} };
  return v;
}
