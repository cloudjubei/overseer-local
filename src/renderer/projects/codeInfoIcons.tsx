import React from 'react'
import type { ProgrammingLanguage } from 'thefactory-tools'
import { IconWrench } from '../components/ui/Icons'

function AbbrevIcon({
  bg,
  fg,
  text,
  title,
  className,
}: {
  bg: string
  fg: string
  text: string
  title?: string
  className?: string
}) {
  // Compact square icon with abbreviation text (16x16 by default)
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      role="img"
      aria-label={title || text}
      className={className}
    >
      <rect x="0" y="0" width="16" height="16" rx="3" fill={bg} />
      <text
        x="8"
        y="11"
        textAnchor="middle"
        fontSize="8"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif"
        fontWeight="700"
        fill={fg}
      >
        {text}
      </text>
    </svg>
  )
}

export function renderLanguageIcon(language?: ProgrammingLanguage, className?: string): React.ReactNode {
  switch (language) {
    case 'javascript':
      return <AbbrevIcon bg="#F7DF1E" fg="#111827" text="JS" title="JavaScript" className={className} />
    case 'typescript':
      return <AbbrevIcon bg="#3178C6" fg="#FFFFFF" text="TS" title="TypeScript" className={className} />
    case 'python':
      return <AbbrevIcon bg="#3776AB" fg="#FFD43B" text="PY" title="Python" className={className} />
    case 'java':
      return <AbbrevIcon bg="#E76F00" fg="#FFFFFF" text="JV" title="Java" className={className} />
    case 'go':
      return <AbbrevIcon bg="#00ADD8" fg="#FFFFFF" text="GO" title="Go" className={className} />
    case 'ruby':
      return <AbbrevIcon bg="#CC342D" fg="#FFFFFF" text="RB" title="Ruby" className={className} />
    case 'php':
      return <AbbrevIcon bg="#777BB4" fg="#FFFFFF" text="PHP" title="PHP" className={className} />
    case 'csharp':
      return <AbbrevIcon bg="#68217A" fg="#FFFFFF" text="C#" title="C#" className={className} />
    case 'cpp':
      return <AbbrevIcon bg="#00599C" fg="#FFFFFF" text="C++" title="C++" className={className} />
    case 'rust':
      return <AbbrevIcon bg="#DEA584" fg="#111827" text="RS" title="Rust" className={className} />
    case 'kotlin':
      return <AbbrevIcon bg="#7F52FF" fg="#FFFFFF" text="KT" title="Kotlin" className={className} />
    case 'swift':
      return <AbbrevIcon bg="#FA7343" fg="#FFFFFF" text="SW" title="Swift" className={className} />
    case 'other':
    default:
      return <IconWrench className={className} />
  }
}
