import { useMemo } from 'react'
import { useChats } from '@core/contexts/ChatsContext'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { Modal } from 'thefactory-ui/web'

export type ChatDynamicContextModalProps = {
  isOpen: boolean
  onClose: () => void
  context: ChatContext
}

/**
 * Web equivalent of desktop's `ChatDynamicContextModal`. Dumps the chat's
 * `dynamicContext` blob (whatever the backend has persisted alongside
 * `messages`) as formatted JSON for inspection.
 */
export default function ChatDynamicContextModal({
  isOpen,
  onClose,
  context,
}: ChatDynamicContextModalProps) {
  const { getChat } = useChats()
  const formatted = useMemo(() => {
    const dyn = getChat(context)?.dynamicContext
    if (!dyn) return undefined
    try {
      return JSON.stringify(dyn, null, 2)
    } catch {
      return String(dyn)
    }
  }, [context, getChat])

  if (!isOpen) return null

  return (
    <Modal isOpen onClose={onClose} title="Dynamic Context" size="lg">
      <div className="max-h-[70vh] overflow-auto text-sm text-(--text-secondary)">
        {formatted ? (
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-5">{formatted}</pre>
        ) : (
          <div className="text-[13px]">No dynamic context available on this chat.</div>
        )}
      </div>
    </Modal>
  )
}
