import React, { createContext, useContext, useMemo } from 'react';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

type ToastMessage = { title?: string; description?: string; variant?: ToastVariant };

type ToastCtx = { toast: (msg: ToastMessage) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const api = useMemo<ToastCtx>(() => ({
    toast: (msg: ToastMessage) => {
      // Minimal stub: could be replaced by a real toast UI
      const prefix = msg.variant ? `[${msg.variant.toUpperCase()}]` : '';
      console.log(prefix, msg.title || '', msg.description || '');
    },
  }), []);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) return { toast: () => {} };
  return v;
}
