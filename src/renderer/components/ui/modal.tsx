import React, { useEffect } from "react";

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  hideCloseButton?: boolean;
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

export function Modal({ isOpen, onClose, title, children, footer, size, hideCloseButton }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={
          `relative z-10 w-full ${sizeClass(size)} rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900`
        }
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4 dark:border-neutral-800">
          <div className="text-base font-semibold">{title}</div>
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        <div className="p-4">{children}</div>
        {footer ? <div className="border-t p-3 dark:border-neutral-800">{footer}</div> : null}
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
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className="inline-flex items-center rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {confirmText}
          </button>
        </div>
      }
    >
      {description ? <p className="text-sm text-neutral-600 dark:text-neutral-300">{description}</p> : null}
    </Modal>
  );
}
