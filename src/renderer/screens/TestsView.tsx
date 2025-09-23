import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'

export default function TestsView() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Tests</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Run tests and view coverage
        </div>
      </div>

      <div className="p-4 space-y-4">
        <SegmentedControl
          ariaLabel="Tests view tabs"
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'results' | 'coverage')}
          options={[
            { value: 'results', label: 'Test Results' },
            { value: 'coverage', label: 'Test Coverage' },
          ]}
        />

        {activeTab === 'results' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-neutral-500">
              Test Results tab. Content coming soon.
            </div>
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-neutral-500">
              Test Coverage tab. Content coming soon.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
