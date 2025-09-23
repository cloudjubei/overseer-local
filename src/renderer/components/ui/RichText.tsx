import React from 'react'
import FileDisplay from './FileDisplay'
import { useFiles } from '../../contexts/FilesContext'
import DependencyBullet from '../stories/DependencyBullet'
import { FileMeta } from 'thefactory-tools'

// Renders text into rich content:
// - @file/path.ext mentions -> inline File chip with hover preview (display mode)
// - #<uuid>(.<uuid>) or #<display>(.<display>) story/feature references -> DependencyBullet (display mode)
// For input mode: wraps mentions with a visual chip while preserving exact text content for layout/caret alignment.

// UUID pattern used by stories/features
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

// Combined tokenizer: captures @file mentions and #dependency tokens while preserving text
// Include the raw matched token (with its leading symbol) so input-mode can render width-preserving content.
function tokenize(input: string): Array<
  { type: 'text'; value: string } |
  { type: 'file'; value: string; raw: string } |
  { type: 'dep'; value: string; raw: string }
> {
  const parts: Array<
    { type: 'text'; value: string } |
    { type: 'file'; value: string; raw: string } |
    { type: 'dep'; value: string; raw: string }
  > = []
  if (!input) return [{ type: 'text', value: '' }]

  const fileRe = /@([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)/g // crude heuristic for file-like tokens
  // Match either UUID or numeric display (e.g., 8), optionally with "." and either UUID or numeric
  const depRe = new RegExp(`#((?:${UUID})|(?:\\d+))(?:\.((?:${UUID})|(?:\\d+)))?`, 'g')

  type Match = { index: number; length: number; type: 'file' | 'dep'; value: string; raw: string }
  const matches: Match[] = []

  let m: RegExpExecArray | null
  while ((m = fileRe.exec(input))) {
    matches.push({ index: m.index, length: m[0].length, type: 'file', value: m[1], raw: m[0] })
  }
  while ((m = depRe.exec(input))) {
    matches.push({
      index: m.index,
      length: m[0].length,
      type: 'dep',
      value: m[0].slice(1) /* drop leading # for value */,
      raw: m[0],
    })
  }

  matches.sort((a, b) => a.index - b.index)

  let lastIndex = 0
  for (const mt of matches) {
    const start = mt.index
    const end = start + mt.length
    if (start > lastIndex) parts.push({ type: 'text', value: input.slice(lastIndex, start) })
    if (mt.type === 'file') parts.push({ type: 'file', value: mt.value, raw: mt.raw })
    else parts.push({ type: 'dep', value: mt.value, raw: mt.raw })
    lastIndex = end
  }
  if (lastIndex < input.length) parts.push({ type: 'text', value: input.slice(lastIndex) })
  return parts
}

export function RichText({ text, variant = 'display' }: { text: string | null | undefined; variant?: 'display' | 'input' }) {
  const { filesByPath } = useFiles()
  const segments = React.useMemo(() => tokenize(text || ''), [text])

  if (variant === 'input') {
    // Input overlay mode: preserve exact text width and content, but visually style mentions as chips.
    return (
      <>
        {segments.map((seg, idx) => {
          if (seg.type === 'text') return <React.Fragment key={idx}>{seg.value}</React.Fragment>
          // seg.type === 'file' | 'dep'
          const raw = seg.raw // includes @ or # prefix; preserve exact characters
          const isFile = seg.type === 'file'
          const label = raw
          return (
            <span
              key={idx}
              className={
                'inline align-baseline rounded-sm px-1 py-[1px] ' +
                'border border-[var(--border-subtle)] ' +
                (isFile
                  ? 'bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] text-[var(--text-primary)]'
                  : 'bg-[color-mix(in_srgb,var(--accent-secondary,_#a78bfa)_10%,transparent)] text-[var(--text-primary)]')
              }
              // Keep the raw text as content to maintain width and caret mapping
            >
              {label}
            </span>
          )
        })}
      </>
    )
  }

  // Display mode (default)
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') return <React.Fragment key={idx}>{seg.value}</React.Fragment>
        if (seg.type === 'dep') {
          return <DependencyBullet key={idx} dependency={seg.value} interactive={false} />
        }
        // seg.type === 'file'
        const token = seg.value
        let meta: FileMeta | null = null
        try {
          const found = filesByPath[token]
          if (found) {
            meta = {
              name: found.name || token.split('/').pop() || token,
              absolutePath: found.absolutePath,
              size: found.size,
              mtime: found.mtime,
              ctime: found.ctime,
              type: found.type,
            }
          } else {
            const short = token.split('/').pop() || token
            const alt = filesByPath[short]
            if (alt)
              meta = {
                name: alt.name || short,
                absolutePath: alt.absolutePath,
                size: alt.size,
                mtime: alt.mtime,
                ctime: alt.ctime,
                type: alt.type,
              }
          }
        } catch (e) {
          // ignore
        }
        if (!meta) {
          return (
            <span
              key={idx}
              className="file-mention file-mention--unresolved"
              title={`File not found: ${token}`}
            >
              @{token}
            </span>
          )
        }
        return (
          <span key={idx} className="inline-file-chip">
            <FileDisplay
              file={meta}
              density="compact"
              interactive={false}
              showPreviewOnHover={true}
              navigateOnClick={false}
              showMeta={false}
              className="inline"
            />
          </span>
        )
      })}
    </>
  )
}

export default RichText
