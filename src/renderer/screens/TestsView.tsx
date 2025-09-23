import React from 'react'

export default function TestsView() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Tests</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Run tests and view coverage
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="text-sm text-neutral-500">Initial tests screen. Content coming soon.</div>
      </div>
    </div>
  )
}
