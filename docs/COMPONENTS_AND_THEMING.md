# UI Components, Popups, Alerts, and Toasts

This project includes a minimal, dependency-free set of UI primitives inspired by shadcn/ui and Tailwind, to provide consistent popups, alerts, and toasts with simple theming.

Location: src/renderer/components/ui/
- toast.tsx: ToastProvider, useToast hook, and Toaster surface. Variants: default, destructive, success, warning, info. Usage mirrors shadcn's toasts while staying dependency-light.
- modal.tsx: Modal and AlertDialog components for popups and confirmations.
- alert.tsx: Inline Alert banners with several color variants.
- index.ts: Barrel export for convenience.

Usage
- Wrap your application tree with ToastProvider to enable toasts.

  Example (App.tsx):
  import { ToastProvider } from "./components/ui";
  export default function AppRoot() {
    return (
      <ToastProvider>
        <App />
      </ToastProvider>
    );
  }

- Trigger toasts via useToast():
  import { useToast } from "./components/ui";
  const { toast } = useToast();
  toast({ title: "Saved", description: "Your changes were saved", variant: "success" });

- Modals and AlertDialog:
  import { Modal, AlertDialog } from "./components/ui";
  Use Modal for custom popups and AlertDialog for confirm/cancel flows.

Theming
- Components are styled using Tailwind-like utility classes. If Tailwind is configured, they will pick up your theme. Without Tailwind, you can replace classes or layer minimal CSS.
- Dark mode is supported via the `dark:` class variants if your app toggles a `dark` class on <html> or <body>.

Notes
- This setup avoids adding new dependencies (e.g., Radix UI) while keeping a familiar API. If you later integrate shadcn/ui, you can map or replace these primitives incrementally.
