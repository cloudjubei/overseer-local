import React from 'react'
import { useTypewriter } from '../../hooks/useTypewriter'
import RichText from './RichText'
import Markdown from './Markdown'

interface TypewriterTextProps {
  text: string
  speed?: number
  renderer?: 'rich' | 'markdown'
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 2, renderer = 'rich' }) => {
  const { displayText, isTyping, skipToEnd } = useTypewriter(text, speed)

  return (
    <div className='relative'>
      {renderer === 'markdown' ? <Markdown text={displayText} /> : <RichText text={displayText} />}

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
