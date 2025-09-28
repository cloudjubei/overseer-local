import React from 'react'
import Tooltip from './Tooltip'
import { goToFile } from '../../navigation/FilesNavigation'
import { useFiles, inferFileType } from '../../contexts/FilesContext'
import { FileMeta } from 'thefactory-tools'

export type FileKind = 'file' | 'folder' | 'symlink' | 'unknown'

export interface FileDisplayProps {
  file: FileMeta
  density?: 'normal' | 'compact'
  interactive?: boolean
  leadingVisual?: React.ReactNode
  trailing?: React.ReactNode
  showMeta?: boolean
  ariaLabel?: string
  onClick?: (file: FileMeta, event: React.MouseEvent) => void
  className?: string
  showPreviewOnHover?: boolean
  previewPlacement?: 'top' | 'bottom' | 'left' | 'right'
  previewDelayMs?: number
  navigateOnClick?: boolean
  [dataAttr: `data-${string}`]: unknown
}

function formatBytes(size?: number | null): string | null {
  if (size == null || Number.isNaN(size)) return null
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let s = size
  let i = 0
  while (s >= 1024 && i < units.length - 1) {
    s /= 1024
    i++
  }
  return `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)} ${units[i]}`
}

function formatDate(input?: number | string | Date | null): string | null {
  if (!input && input !== 0) return null
  let d: Date
  if (input instanceof Date) d = input
  else if (typeof input === 'number') d = new Date(input)
  else d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function extFromTypeOrName(type?: string | null, name?: string): string | null {
  if (type) {
    const parts = type.split('/')
    if (parts.length === 2 && parts[1]) return parts[1]
  }
  if (name && name.includes('.')) {
    const ext = name.split('.').pop()
    if (ext) return ext.toLowerCase()
  }
  return null
}

function SvgIcon({
  path,
  stroke,
  fill,
  size = 20,
  viewBox = '0 0 24 24',
}: {
  path: React.ReactNode
  stroke?: string
  fill?: string
  size?: number
  viewBox?: string
}) {
  return (
    <span className="fd-icon" aria-hidden>
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {path}
      </svg>
    </span>
  )
}

function iconForExt(ext: string | null): React.ReactNode {
  const e = (ext || '').toLowerCase()
  // Basic set of meaningful icons; keep simple inline SVGs to avoid asset pipeline issues
  switch (e) {
    case 'md':
    case 'markdown': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#e8eefc" stroke="#a7b7f9" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fontSize="9"
                fill="#3b5bdb"
                fontFamily="monospace"
              >
                MD
              </text>
            </>
          }
        />
      )
    }
    case 'json': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#ecf7ff" stroke="#8ed0ff" />
              <path
                d="M9 9c-2 0-2 6 0 6M15 9c2 0 2 6 0 6"
                stroke="#1c7ed6"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </>
          }
        />
      )
    }
    case 'js':
    case 'cjs':
    case 'mjs': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#fffbe6" stroke="#ffe58f" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fontSize="9"
                fill="#d4b106"
                fontFamily="monospace"
              >
                JS
              </text>
            </>
          }
        />
      )
    }
    case 'ts':
    case 'tsx': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#e7f5ff" stroke="#a5d8ff" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fontSize="9"
                fill="#1971c2"
                fontFamily="monospace"
              >
                TS
              </text>
            </>
          }
        />
      )
    }
    case 'css': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#f3f0ff" stroke="#d0bfff" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fontSize="9"
                fill="#7048e8"
                fontFamily="monospace"
              >
                CSS
              </text>
            </>
          }
        />
      )
    }
    case 'html':
    case 'htm': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#fff0f0" stroke="#ffc9c9" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fontSize="8"
                fill="#e03131"
                fontFamily="monospace"
              >
                HTML
              </text>
            </>
          }
        />
      )
    }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'svg':
    case 'webp': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#ecfdf5" stroke="#b2f2bb" />
              <path d="M6 17l4-5 3 4 2-3 3 4H6z" fill="#40c057" />
              <circle cx="9" cy="9" r="1.5" fill="#37b24d" />
            </>
          }
        />
      )
    }
    case 'pdf': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#fff5f5" stroke="#ffa8a8" />
              <text
                x="12"
                y="16"
                textAnchor="middle"
                fontSize="9"
                fill="#c92a2a"
                fontFamily="monospace"
              >
                PDF
              </text>
            </>
          }
        />
      )
    }
    case 'zip':
    case 'tar':
    case 'gz':
    case 'tgz':
    case 'rar': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#fff9db" stroke="#ffe8a1" />
              <path d="M12 6v12M12 6h2M12 9h2M12 12h2M12 15h2" stroke="#e67700" strokeWidth="1.5" />
            </>
          }
        />
      )
    }
    case 'txt':
    case 'log':
    case 'text': {
      return (
        <SvgIcon
          path={
            <>
              <rect x="2" y="3" width="20" height="18" rx="2" fill="#f8f9fa" stroke="#dee2e6" />
              <path
                d="M6 8h10M6 11h10M6 14h8"
                stroke="#495057"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </>
          }
        />
      )
    }
    default: {
      return (
        <span className="fd-icon fd-icon--badge" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect
              x="4"
              y="3"
              width="16"
              height="18"
              rx="2"
              fill="var(--surface-2, #f5f6f8)"
              stroke="var(--border-subtle, #d9dbe1)"
            />
            <path
              d="M8 8h8M8 12h8M8 16h6"
              stroke="var(--text-muted)"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )
    }
  }
}

function defaultIconFor(file: FileMeta): React.ReactNode {
  const ext = extFromTypeOrName(file.type ?? undefined, file.name)
  return iconForExt(ext)
}

const textLikeTypes = new Set([
  'markdown',
  'text',
  'json',
  'yaml',
  'yml',
  'javascript',
  'typescript',
  'styles',
  'css',
  'md',
  'txt',
])

function isTextLike(file: FileMeta): boolean {
  const t = (file.type || inferFileType(file.absolutePath || file.name)).toString().toLowerCase()
  return textLikeTypes.has(t)
}

const MAX_PREVIEW_CHARS = 1200

function useFilePreviewContent(file: FileMeta) {
  const { readFile } = useFiles()
  const [state, setState] = React.useState<{
    loading: boolean
    error: string | null
    text: string | null
  }>({ loading: false, error: null, text: null })
  React.useEffect(() => {
    let cancelled = false
    const relPath = file.relativePath
    if (!relPath || !isTextLike(file)) {
      setState((s) => ({ ...s, loading: false, text: null, error: null }))
      return
    }
    setState({ loading: true, error: null, text: null })
    ;(async () => {
      try {
        const content = await readFile(relPath)
        if (cancelled) return
        if (typeof content === 'string') {
          const snippet = content.slice(0, MAX_PREVIEW_CHARS)
          setState({ loading: false, error: null, text: snippet })
        } else {
          setState({ loading: false, error: null, text: null })
        }
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, error: e?.message || String(e), text: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file.absolutePath, file.type, file.name])
  return state
}

function FilePreviewCard({ file }: { file: FileMeta }) {
  const sizeLabel = formatBytes(file.size ?? null)
  const dateLabel = formatDate(file.mtime ?? null)
  const typeLabel = (file.type || inferFileType(file.absolutePath || file.name)).toString()
  const relPath = file.relativePath
  const { loading, error, text } = useFilePreviewContent(file)

  return (
    <div className="file-preview-card">
      <div className="file-preview-card__header">
        <div className="file-preview-card__title" title={relPath || file.name}>
          {file.name}
        </div>
        <div className="file-preview-card__meta">
          {typeLabel}
          {sizeLabel ? ` • ${sizeLabel}` : ''}
          {dateLabel ? ` • ${dateLabel}` : ''}
        </div>
      </div>
      {relPath && (
        <div className="file-preview-card__path" title={relPath}>
          {relPath}
        </div>
      )}
      <div className="file-preview-card__body">
        {loading && <div className="file-preview-card__loading">Loading preview…</div>}
        {error && <div className="file-preview-card__error">{error}</div>}
        {!loading && !error && text && (
          <pre className="file-preview-card__pre">
            <code>{text}</code>
          </pre>
        )}
        {!loading && !error && !text && (
          <div className="file-preview-card__empty">No preview available</div>
        )}
      </div>
    </div>
  )
}

export const FileDisplay: React.FC<FileDisplayProps> = ({
  file,
  density = 'normal',
  interactive = false,
  leadingVisual,
  trailing,
  showMeta = true,
  ariaLabel,
  onClick,
  className = '',
  showPreviewOnHover = false,
  previewPlacement = 'right',
  previewDelayMs = 300,
  navigateOnClick = true,
  ...dataAttrs
}) => {
  const sizeLabel = formatBytes(file.size ?? null)
  const dateLabel = formatDate(file.mtime ?? null)

  const role = interactive ? 'button' : undefined
  const tabIndex = interactive ? 0 : undefined
  const aria =
    ariaLabel ||
    `${file.name}${sizeLabel ? `, ${sizeLabel}` : ''}${dateLabel ? `, modified ${dateLabel}` : ''}`

  async function handleNavigate(e: React.MouseEvent) {
    if (!file.absolutePath) return
    await goToFile(file.absolutePath)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!interactive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onClick) {
        onClick(file, e as unknown as React.MouseEvent)
      } else if (navigateOnClick) {
        handleNavigate(e as unknown as React.MouseEvent)
      }
    }
  }

  const isCompact = density === 'compact'
  const cls = [
    'file-display',
    isCompact ? 'is-compact' : 'is-normal',
    interactive ? 'is-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tooltip
      content={<FilePreviewCard file={file} />}
      placement={previewPlacement}
      delayMs={previewDelayMs}
      disabled={!showPreviewOnHover}
    >
      {isCompact ? (
        <span className="badge badge--soft badge--ok">{file.name}</span>
      ) : (
        <div
          className={cls}
          role={role}
          tabIndex={tabIndex}
          aria-label={aria}
          onKeyDown={handleKeyDown}
          onClick={
            interactive
              ? onClick
                ? (e) => onClick(file, e)
                : navigateOnClick
                  ? handleNavigate
                  : undefined
              : undefined
          }
          {...(dataAttrs as Record<string, string>)}
        >
          <div className="fd-leading">{leadingVisual ?? defaultIconFor(file)}</div>
          <div className="fd-content">
            <div className="fd-name" title={file.absolutePath || file.name}>
              {file.name}
            </div>
            {showMeta && sizeLabel && <div className="fd-size">{sizeLabel}</div>}
          </div>
          <div className="fd-right">
            {showMeta && dateLabel && <div className="fd-date">{dateLabel}</div>}
            {trailing ? <div className="fd-trailing">{trailing}</div> : null}
          </div>
        </div>
      )}
    </Tooltip>
  )
}

export default FileDisplay
