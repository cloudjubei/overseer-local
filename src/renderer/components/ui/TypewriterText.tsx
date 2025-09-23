import React from 'react'
import { useTypewriter } from '../../hooks/useTypewriter'
import RichText from './RichText'

interface TypewriterTextProps {
  text: string
  speed?: number
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed }) => {
  const displayText = useTypewriter(text, speed)

  return <RichText text={displayText} />
}

export default TypewriterText
