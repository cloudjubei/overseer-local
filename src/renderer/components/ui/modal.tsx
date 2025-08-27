import React, { useEffect } from 'react'

export type ModalProps = {
  title?: string
  onClose?: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="cmd-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="cmd" style={{ maxWidth: 720 }}>
        <div className="cmd__input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600 }}>{title}</div>
          <button className="btn-secondary" onClick={() => onClose?.()} aria-label="Close">×</button>
        </div>
        <div className="cmd__list" style={{ padding: 12 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
