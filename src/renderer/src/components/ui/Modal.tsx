import React, { useEffect, useLayoutEffect, useRef, useId } from 'react'
import { Button } from './Button'

export type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideCloseButton?: boolean
  initialFocusRef?: React.RefObject<HTMLElement>
  // Optional id of a description element rendered within the modal content
  // When provided, the dialog will set aria-describedby to this id
  descriptionId?: string
  // Control whether pressing Escape closes the modal (default: true)
  closeOnEsc?: boolean
  // Control whether clicking the overlay closes the modal (default: true)
  closeOnOverlayClick?: boolean
  // Optional header action area (e.g., buttons on the right of the title, before the close button)
  headerActions?: React.ReactNode
  // Optional override for the content container className (defaults to a scrollable padded container)
  contentClassName?: string
}

function sizeClass(size?: ModalProps['size']) {
  switch (size) {
    case 'sm':
      return 'max-w-sm'
    case 'md':
      return 'max-w-md'
    case 'lg':
      return 'max-w-lg'
    case 'xl':
      return 'max-w-2xl'
    default:
      return 'max-w-lg'
  }
}

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ]
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')))
  return nodes.filter((n) => !n.hasAttribute('disabled') && !n.getAttribute('aria-hidden'))
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size,
  hideCloseButton,
  initialFocusRef,
  descriptionId,
  closeOnEsc = true,
  closeOnOverlayClick = true,
  headerActions,
  contentClassName,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocusedEl = useRef<HTMLElement | null>(null)
  const previousOverflowRef = useRef<string>('')

  // Unique title id for aria-labelledby
  const reactId = useId()
  const titleId = title ? `modal-title-${reactId}` : undefined

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, closeOnEsc])

  // Lock body scroll while modal is open, restore on close/unmount
  useEffect(() => {
    if (!isOpen) return
    previousOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflowRef.current
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) return
    previouslyFocusedEl.current = document.activeElement as HTMLElement | null

    const toFocus = initialFocusRef?.current || getFocusable(panelRef.current!)[0]
    toFocus?.focus()

    return () => {
      previouslyFocusedEl.current?.focus?.()
    }
  }, [isOpen, initialFocusRef])

  if (!isOpen) return null

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && closeOnOverlayClick) onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = getFocusable(panelRef.current!)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const contentClasses = contentClassName || 'flex-grow overflow-y-auto p-4'

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
          `relative z-10 w-full flex flex-col ${sizeClass(size)} rounded-lg border bg-surface-overlay text-text-primary shadow-xl max-h-[90vh]` +
          ' border-border outline-none focus:outline-none animate-in fade-in-50 zoom-in-95'
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start justify-between gap-4 border-b p-4 shrink-0 border-border">
          <div className="text-base font-semibold" id={titleId}>
            {title}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="Close"
                title="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className={contentClasses}>{children}</div>
        {footer ? <div className="shrink-0 border-t p-3 border-border">{footer}</div> : null}
      </div>
    </div>
  )
}

export function AlertDialog({
  isOpen,
  onClose,
  title = 'Are you sure?',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  initialFocusRef,
  destructiveConfirm = false,
  disableOutsideClose = false,
}: {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  initialFocusRef?: React.RefObject<HTMLElement>
  destructiveConfirm?: boolean
  disableOutsideClose?: boolean
}) {
  const confirmRef = initialFocusRef || React.useRef<HTMLButtonElement>(null)
  // Generate a description id only when a description is provided
  const descriptionReactId = React.useId()
  const descId = description ? `modal-description-${descriptionReactId}` : undefined

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      initialFocusRef={confirmRef as React.RefObject<HTMLElement>}
      descriptionId={descId}
      hideCloseButton={disableOutsideClose}
      closeOnEsc={!disableOutsideClose}
      closeOnOverlayClick={!disableOutsideClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">
            {cancelText}
          </Button>
          <Button
            ref={confirmRef as React.RefObject<HTMLButtonElement>}
            onClick={() => {
              onConfirm?.()
              onClose()
            }}
            variant={destructiveConfirm ? 'danger' : 'primary'}
            className={destructiveConfirm ? 'btn-secondary' : undefined}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      {description ? (
        <p id={descId} className="text-sm text-text-secondary">
          {description}
        </p>
      ) : null}
    </Modal>
  )
}
