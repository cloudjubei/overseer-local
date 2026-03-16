import { useMemo } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import type { ChatDynamicContext } from 'thefactory-tools'

export type ChatDynamicContextModalProps = {
  isOpen: boolean
  onClose: () => void
  dynamicContext?: ChatDynamicContext
}

export default function ChatDynamicContextModal({
  isOpen,
  onClose,
  dynamicContext,
}: ChatDynamicContextModalProps) {
  const formatted = useMemo(() => {
    if (!dynamicContext) return undefined
    try {
      return JSON.stringify(dynamicContext, null, 2)
    } catch {
      return String(dynamicContext)
    }
  }, [dynamicContext])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dynamic Context"
      size="xl"
      contentClassName="flex-grow overflow-hidden p-0"
    >
      <div className="h-full max-h-[70vh] overflow-auto p-4 bg-[var(--surface-base)] text-sm text-[var(--text-secondary)]">
        {formatted ? (
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-5">{formatted}</pre>
        ) : (
          <div className="text-[13px]">No dynamic context available on this chat.</div>
        )}
      </div>
    </Modal>
  )
}
