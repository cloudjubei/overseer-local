/**
 * Renders a unified-diff string with green/red lines. Tolerant of empty diffs
 * (returned when a write is a no-op) and of binary / "no newline" markers,
 * which it just prints as plain context lines.
 */
export default function UnifiedDiffView({ diff }: { diff: string }) {
  if (diff.trim().length === 0) {
    return (
      <div className="text-xs opacity-60 italic" data-testid="unified-diff-empty">
        No changes.
      </div>
    )
  }

  const lines = diff.split('\n')
  return (
    <pre
      className="font-mono text-xs leading-snug overflow-x-auto rounded border"
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--surface-base)',
      }}
    >
      {lines.map((line, idx) => (
        <DiffLine key={idx} line={line} />
      ))}
    </pre>
  )
}

function DiffLine({ line }: { line: string }) {
  const kind = classify(line)
  const bg =
    kind === 'add'
      ? 'color-mix(in srgb, var(--color-green-600) 18%, transparent)'
      : kind === 'del'
        ? 'color-mix(in srgb, var(--color-red-600) 18%, transparent)'
        : kind === 'hunk'
          ? 'color-mix(in srgb, var(--color-blue-600) 14%, transparent)'
          : kind === 'meta'
            ? 'transparent'
            : 'transparent'
  const fg =
    kind === 'meta' ? 'var(--text-muted)' : kind === 'hunk' ? 'var(--text-secondary)' : undefined
  return <div style={{ background: bg, color: fg, padding: '0 0.5rem' }}>{line || ' '}</div>
}

type LineKind = 'add' | 'del' | 'hunk' | 'meta' | 'ctx'

function classify(line: string): LineKind {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) return 'meta'
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return 'ctx'
}
