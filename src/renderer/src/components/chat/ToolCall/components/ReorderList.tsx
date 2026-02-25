import React from 'react'

export function ReorderList({
  items,
  movedId,
}: {
  items: any[]
  movedId?: string
}) {
  return (
    <div className='text-xs space-y-1'>
      {items.map((it, idx) => {
        const id = typeof it === 'string' ? it : it?.id || it?.key || it?.title || String(idx)
        const title = it?.title || id
        const moved = movedId && (it?.id === movedId || id === movedId)

        return (
          <div key={id} className={moved ? 'font-semibold' : undefined}>
            {idx + 1}. {title}
          </div>
        )
      })}
    </div>
  )
}
