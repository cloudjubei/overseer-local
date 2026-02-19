import { useMemo } from 'react'
import { highlight } from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-diff'
import 'prismjs/themes/prism-tomorrow.css' // Using tomorrow theme

const SUPPORTED: Record<string, true> = {
  json: true,
  typescript: true,
  bash: true,
  python: true,
  diff: true,
  text: true,
}

interface CodeProps {
  code: string
  language: 'json' | 'typescript' | 'bash' | 'python' | 'text' | 'diff' | string
}

export default function Code({ code, language }: CodeProps) {
  const lang = typeof language === 'string' && SUPPORTED[language] ? (language as string) : 'text'

  // Memoize the expensive Prism highlight call — only recompute when code or language changes.
  const html = useMemo(() => {
    if (lang === 'text') return null
    const prism = (window as any).Prism
    const grammar = prism?.languages?.[lang]
    if (!grammar) return null
    return highlight(code, grammar, lang)
  }, [code, lang])

  if (lang === 'text' || html === null) {
    return (
      <pre className="text-sm text-[var(--text-primary)] bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <pre
      className={`language-${lang} text-sm !bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
