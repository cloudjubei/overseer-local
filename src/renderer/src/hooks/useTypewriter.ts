import { useState, useEffect, useRef } from 'react'

export function useTypewriter(text: string, speed: number = 50) {
  const [displayText, setDisplayText] = useState('')
  const index = useRef(0)

  useEffect(() => {
    setDisplayText('')
    index.current = 0
    const intervalId = setInterval(() => {
      if (index.current < text.length) {
        setDisplayText((prev) => prev + text.charAt(index.current))
        index.current += 1
      } else {
        clearInterval(intervalId)
      }
    }, speed)

    return () => clearInterval(intervalId)
  }, [text, speed])

  return displayText
}
