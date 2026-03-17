import React from 'react'

export function splitPath(p: string): { dir: string; name: string } {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (idx === -1) return { dir: '', name: p }
  return { dir: p.slice(0, idx + 1), name: p.slice(idx + 1) }
}

// Left aligned path with bold filename; directory left-truncated (RTL trick)
// The flex layout here ensures sequential shrinking:
// 1. Directory path shrinks down to 0 first.
// 2. Only when directory is fully collapsed does filename start shrinking.
export function PathDisplay({ path }: { path: string }) {
  const { dir, name } = splitPath(path)
  return (
    <div className="flex items-baseline min-w-0 w-full overflow-hidden">
      {dir ? (
        <span
          className="truncate text-neutral-500"
          style={{ flexShrink: 1, minWidth: 0, direction: 'rtl', textAlign: 'left' }}
        >
          <span style={{ direction: 'ltr' }}>{`/${dir}`}</span>
        </span>
      ) : null}
      <span
        className="font-mono font-semibold truncate"
        style={{ flexShrink: 0, maxWidth: '100%' }}
      >
        {dir ? `\u00A0${name}` : name}
      </span>
    </div>
  )
}
