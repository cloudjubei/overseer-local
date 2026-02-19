import React, { memo } from 'react'
import type { ChatMessage } from 'thefactory-tools'
import Markdown from '../ui/Markdown'
import { messageIso } from '@renderer/utils/chat'
import { formatFriendlyTimestamp } from '@renderer/utils/time'

function SystemPromptBubble({
  message,
  maxHeight,
}: {
  message: ChatMessage
  maxHeight?: number
}) {
  const iso = messageIso(message)
  const ts = iso ? formatFriendlyTimestamp(iso) : ''

  return (
    <div className='flex justify-center'>
      <div className='inline-flex flex-col items-end max-w-full'>
        {ts ? (
          <div className='text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none'>
            {ts}
          </div>
        ) : null}
        <div
          className={[
            'overflow-y-auto overflow-x-auto max-w-full px-3 py-2 rounded-2xl break-words shadow border',
            'bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]',
            'chat-bubble',
          ].join(' ')}
          style={{
            maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : undefined,
            minHeight: '3.5em',
          }}
          aria-label='System prompt'
        >
          <Markdown text={message.completionMessage.content} />
        </div>
      </div>
    </div>
  )
}

export default memo(SystemPromptBubble)
