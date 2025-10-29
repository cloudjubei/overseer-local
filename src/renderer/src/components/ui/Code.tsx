import { highlight } from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-diff'
import 'prismjs/themes/prism-tomorrow.css' // Using tomorrow theme

interface CodeProps {
  code: string
  language: 'json' | 'typescript' | 'bash' | 'python' | 'text' | 'diff' | string
}

export default function Code({ code, language }: CodeProps) {
  // Normalize language and provide safe fallback
  const supported: Record<string, true> = {
    json: true,
    typescript: true,
    bash: true,
    python: true,
    diff: true,
    text: true,
  }
  const lang = typeof language === 'string' && supported[language] ? (language as string) : 'text'

  if (lang === 'text') {
    return (
      <pre className="text-sm text-[var(--text-primary)] bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    )
  }
  const prism = (window as any).Prism
  const grammar = prism?.languages?.[lang]
  if (!grammar) {
    return (
      <pre className="text-sm text-[var(--text-primary)] bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    )
  }
  const html = highlight(code, grammar, lang)
  return (
    <pre
      className={`language-${lang} text-sm !bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
