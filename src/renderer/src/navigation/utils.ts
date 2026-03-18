export function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setMatches(m.matches)
    if (m.addEventListener) m.addEventListener('change', onChange)
    else m.addListener(onChange)
    setMatches(m.matches)
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', onChange)
      else m.removeListener(onChange)
    }
  }, [query])
  return matches
}

export function useAccentClass(seed: string, isMain: boolean): string {
  if (isMain) {
    return 'nav-item nav-accent-gray'
  }
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
  const i = n % 3
  switch (i) {
    case 0:
      return 'nav-accent-teal'
    case 1:
      return 'nav-accent-purple'
    case 2:
    default:
      return 'nav-accent-brand'
  }
}
