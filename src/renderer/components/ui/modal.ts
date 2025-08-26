import React from 'react'
import { Modal as BaseModal } from './Modal'

// Compatibility wrapper for legacy lower-case imports (e.g., ChatView)
// It defaults isOpen to true so callers don't need to pass it.
export type CompatModalProps = {
  onClose: () => void
  children?: React.ReactNode
  title?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideCloseButton?: boolean
  isOpen?: boolean
}

export function Modal({ onClose, children, title, footer, size, hideCloseButton, isOpen }: CompatModalProps) {
  return (
    <BaseModal
      isOpen={isOpen ?? true}
      onClose={onClose}
      title={title}
      footer={footer}
      size={size}
      hideCloseButton={hideCloseButton}
    >
      {children}
    </BaseModal>
  )
}

export default Modal
