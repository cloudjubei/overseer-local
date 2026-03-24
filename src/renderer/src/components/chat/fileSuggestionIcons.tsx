import React from 'react'
import { IconFileBadge } from '../ui/icons/Icons'

export type FileSuggestionIconKind = 'folder' | 'file'

function extFromPath(path: string): string | null {
  const base = path.split('/').pop() || path
  const idx = base.lastIndexOf('.')
  if (idx === -1) return null
  const ext = base.slice(idx + 1).trim().toLowerCase()
  return ext || null
}

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

export function renderFileSuggestionIcon(
  params: { path: string; kind?: FileSuggestionIconKind },
  className?: string,
): React.ReactNode {
  const { path, kind = 'file' } = params

  if (kind === 'folder') {
    // Folder icon handled by caller so they can choose open/closed state.
    // Return a subtle neutral badge here as a fallback.
    return <AbbrevIcon bg="#e5e7eb" fg="#111827" text="DIR" title="Folder" className={className} />
  }

  const ext = extFromPath(path)
  switch (ext) {
    case 'ts':
      return <AbbrevIcon bg="#3178C6" fg="#FFFFFF" text="TS" title="TypeScript" className={className} />
    case 'tsx':
      return <AbbrevIcon bg="#3178C6" fg="#FFFFFF" text="TSX" title="TypeScript (TSX)" className={className} />
    case 'py':
      return <AbbrevIcon bg="#3776AB" fg="#FFD43B" text="PY" title="Python" className={className} />
    case 'js':
      return <AbbrevIcon bg="#F7DF1E" fg="#111827" text="JS" title="JavaScript" className={className} />
    case 'jsx':
      return <AbbrevIcon bg="#F7DF1E" fg="#111827" text="JSX" title="JavaScript (JSX)" className={className} />
    case 'json':
      return <AbbrevIcon bg="#1c7ed6" fg="#FFFFFF" text="JSON" title="JSON" className={className} />
    case 'md':
    case 'mdx':
      return <AbbrevIcon bg="#6b7280" fg="#FFFFFF" text="MD" title="Markdown" className={className} />
    default: {
      // Re-use generic file badge icon for unknown extensions.
      const label = ext ? ext.toUpperCase().slice(0, 3) : 'FILE'
      return (
        <span className={className} aria-hidden>
          <IconFileBadge badgeText={label} fill="#f3f4f6" stroke="#d1d5db" textColor="#111827" size={16} />
        </span>
      )
    }
  }
}
