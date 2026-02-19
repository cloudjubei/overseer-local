import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useTypewriter } from '../../hooks/useTypewriter'
import RichText from './RichText'
import Markdown from './Markdown'

interface TypewriterTextProps {
  text: string
  speed?: number
  renderer?: 'rich' | 'markdown'
}

/**
 * Debounced Markdown renderer: during rapid typing we render cheap pre-formatted
 * text and only invoke the full Markdown pipeline after content has been stable
 * for `debounceMs` milliseconds. Once typing finishes we always render full Markdown.
 */
function DebouncedMarkdown({ text, isTyping }: { text: string; isTyping: boolean }) {
  const DEBOUNCE_MS = 120
  const [committedText, setCommittedText] = useState(text)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isTyping) {
      // Typing done — render full markdown immediately
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setCommittedText(text)
      return
    }

    // During typing, debounce Markdown commits
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCommittedText(text)
      timerRef.current = null
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text, isTyping])

  // While typing, show the debounced markdown for structure + a cheap live tail
  // for the characters that arrived after the last committed snapshot.
  if (isTyping) {
    // If the committed text is a prefix of current text, render committed Markdown
    // plus a lightweight <span> for the new tail. This gives good visual fidelity
    // without re-running the full pipeline every frame.
    const tail = text.startsWith(committedText) ? text.slice(committedText.length) : ''
    return (
      <div>
        <Markdown text={committedText} />
        {tail ? (
          <span className='whitespace-pre-wrap break-words'>{tail}</span>
        ) : null}
      </div>
    )
  }

  return <Markdown text={committedText} />
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 2, renderer = 'rich' }) => {
  const { displayText, isTyping, skipToEnd } = useTypewriter(text, speed)

  return (
    <div className='relative'>
      {renderer === 'markdown' ? (
        <DebouncedMarkdown text={displayText} isTyping={isTyping} />
      ) : (
        <RichText text={displayText} />
      )}

      {isTyping ? (
        <button
          type='button'
          className={[
            'absolute bottom-2 right-2 z-10',
            'btn-secondary',
            'text-[11px] px-2 py-1',
            'shadow-sm',
          ].join(' ')}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            skipToEnd()
          }}
          aria-label='Skip to end'
          title='Skip to end'
        >
          Skip to end
        </button>
      ) : null}
    </div>
  )
}

export default TypewriterText
