import React, { useEffect, useLayoutEffect, useRef } from "react";

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  hideCloseButton?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
};

function sizeClass(size?: ModalProps["size"]) {
  switch (size) {
    case "sm":
      return "max-w-sm";
    case "md":
      return "max-w-md";
    case "lg":
      return "max-w-lg";
    case "xl":
      return "max-w-2xl";
    default:
      return "max-w-lg";
  }
}

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const selectors = [
    'a[href]','button:not([disabled])','textarea:not([disabled])','input:not([disabled])','select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
  return nodes.filter(n => !n.hasAttribute('disabled') && !n.getAttribute('aria-hidden'));
}

export function Modal({ isOpen, onClose, title, children, footer, size, hideCloseButton, initialFocusRef }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    previouslyFocusedEl.current = document.activeElement as HTMLElement | null;

    const toFocus = initialFocusRef?.current || getFocusable(panelRef.current!)[0];
    toFocus?.focus();

    return () => {
      previouslyFocusedEl.current?.focus?.();
    };
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusables = getFocusable(panelRef.current!);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" aria-hidden={false}>
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-100 animate-in fade-in"
        onMouseDown={onOverlayClick}
      />
      <div
        ref={panelRef}
        className={
          `relative z-10 w-full ${sizeClass(size)} rounded-lg border bg-surface-overlay text-text-primary shadow-xl max-h-[90vh]` +
          " border-border outline-none focus:outline-none animate-in fade-in-50 zoom-in-95"
        }
        role="dialog"
        aria-modal="true"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start justify-between gap-4 border-b p-4 shrink-0 border-border">
          <div className="text-base font-semibold">{title}</div>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label="Close"
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
        <div className="flex-grow overflow-y-auto p-4">{children}</div>
        {footer ? <div className="shrink-0 border-t p-3 border-border">{footer}</div> : null}
      </div>
    </div>
  );
}

export function AlertDialog({
  isOpen,
  onClose,
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  initialFocusRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement>;
}) {
  const confirmRef = initialFocusRef || React.useRef<HTMLButtonElement>(null);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      initialFocusRef={confirmRef as React.RefObject<HTMLElement>}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm bg-surface-raised text-text-primary hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-sm text-text-inverted hover:bg-brand-700 focus-visible:ring-2"
          >
            {confirmText}
          </button>
        </div>
      }
    >
      {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
    </Modal>
  );
}
