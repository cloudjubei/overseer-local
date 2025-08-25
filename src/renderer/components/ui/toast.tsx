import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms, default 3500
  action?: { label: string; onClick: () => void };
};

export type ToastContextValue = {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id"> & { id?: string }) => string; // returns id
  dismiss: (id: string) => void;
  clearAll: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number | ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer as number);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>((t) => {
    const id = t.id ?? uid();
    const duration = t.duration ?? 3500;
    setToasts((prev) => [{ id, ...t, duration }, ...prev]);
    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  const clearAll = useCallback(() => {
    setToasts([]);
    for (const timer of timers.current.values()) clearTimeout(timer as number);
    timers.current.clear();
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  const value = useMemo(() => ({ toasts, toast, dismiss, clearAll }), [toasts, toast, dismiss, clearAll]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed inset-0 z-[1000] flex flex-col-reverse items-end gap-2 p-4 sm:items-end">
      <div className="ml-auto flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}

function variantClasses(variant?: ToastVariant) {
  switch (variant) {
    case "destructive":
      return "bg-red-600 text-white border-red-700";
    case "success":
      return "bg-emerald-600 text-white border-emerald-700";
    case "warning":
      return "bg-amber-500 text-black border-amber-600";
    case "info":
      return "bg-sky-600 text-white border-sky-700";
    default:
      return "bg-neutral-800 text-white border-neutral-700";
  }
}

function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  return (
    <div
      className={
        "pointer-events-auto w-full overflow-hidden rounded-md border shadow-lg transition-all " +
        variantClasses(t.variant)
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1">
          {t.title ? <div className="text-sm font-semibold leading-tight">{t.title}</div> : null}
          {t.description ? (
            <div className="mt-0.5 text-xs/5 opacity-90">{t.description}</div>
          ) : null}
        </div>
        {t.action ? (
          <button
            type="button"
            onClick={() => t.action?.onClick()}
            className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
          >
            {t.action.label}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Convenience helpers similar to shadcn toast
export function toast(opts: Omit<Toast, "id"> & { id?: string }) {
  // This helper relies on a provider in the tree; for non-React callers, consider exposing a global bus.
  console.warn("toast() called outside React context. Use the useToast() hook inside components.");
  return "";
}
