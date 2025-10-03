import { highlight } from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/themes/prism-tomorrow.css' // Using tomorrow theme

interface CodeProps {
  code: string
  language: 'json' | 'typescript' | 'bash' | 'python' | 'text'
}

export default function Code({ code, language }: CodeProps) {
  if (language === 'text') {
    return (
      <pre className="text-sm text-[var(--text-primary)] bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto">
        <code>{code}</code>
      </pre>
    )
  }
  const html = highlight(code, (window as any).Prism.languages[language], language)
  return (
    <pre
      className={`language-${language} text-sm !bg-[var(--surface-raised)] p-2 rounded-md overflow-x-auto`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
