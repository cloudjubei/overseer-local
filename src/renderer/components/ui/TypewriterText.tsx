import React from 'react'
import { useTypewriter } from '../../hooks/useTypewriter'
import RichText from './RichText'
import Markdown from './Markdown'

interface TypewriterTextProps {
  text: string
  speed?: number
  renderer?: 'rich' | 'markdown'
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 5, renderer = 'rich' }) => {
  const displayText = useTypewriter(text, speed)

  if (renderer === 'markdown') {
    return <Markdown text={displayText} />
  }
  return <RichText text={displayText} />
}

export default TypewriterText
