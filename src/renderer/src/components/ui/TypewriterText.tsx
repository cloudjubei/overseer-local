import React, { useEffect, useRef, useState } from 'react'
import { useTypewriter } from '../../hooks/useTypewriter'
import RichText from './RichText'
import Markdown from './Markdown'

interface TypewriterTextProps {
  text: string
  speed?: number
  renderer?: 'rich' | 'markdown'
}

/**
 * Debounced Markdown renderer.
 *
 * IMPORTANT: While the typewriter effect is running, we must render Markdown using
 * the exact same component/pipeline as the final state. The animation should only
 * control how much text is revealed, not change how Markdown is interpreted.
 *
 * This component debounces updates to reduce Markdown re-parses during rapid typing,
 * but it always renders a single `<Markdown />` tree (no 'raw tail' spans).
 */
function DebouncedMarkdown({ text, isTyping }: { text: string; isTyping: boolean }) {
  const DEBOUNCE_MS = 16
  const [debouncedText, setDebouncedText] = useState(text)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // If typing is finished, snap immediately to the final text.
    if (!isTyping) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setDebouncedText(text)
      return
    }

    // During typing, debounce updates so we don't re-run the Markdown pipeline
    // on every character.
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedText(text)
      timerRef.current = null
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text, isTyping])

  return <Markdown text={isTyping ? debouncedText : text} />
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
