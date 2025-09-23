import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { testsService } from '../services/testsService'

export default function TestsView() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')
  const [isRunning, setIsRunning] = React.useState(false)
  const [rawResults, setRawResults] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const runTests = async () => {
    setIsRunning(true)
    setError(null)
    setRawResults(null)
    try {
      const res = await testsService.runTests()
      if (!res?.ok) {
        setError(typeof res?.raw === 'string' ? res.raw : 'Failed to run tests')
      } else {
        setRawResults(typeof res.raw === 'string' ? res.raw : JSON.stringify(res.raw, null, 2))
      }
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Tests</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">Run tests and view coverage</div>
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
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Button onClick={runTests} loading={isRunning} variant="primary">
                Run Tests
              </Button>
              {isRunning ? <Spinner size={16} label="Running tests..." /> : null}
            </div>

            {error ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
            ) : null}

            {!isRunning && !error && rawResults && (
              <pre className="text-xs bg-neutral-50 dark:bg-neutral-900 p-3 rounded-md overflow-auto max-h-[60vh] whitespace-pre-wrap">
                {rawResults}
              </pre>
            )}

            {!isRunning && !error && !rawResults && (
              <div className="text-sm text-neutral-500">No test results yet. Click "Run Tests" to start.</div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="text-sm text-neutral-500">Test Coverage tab. Content coming soon.</div>
          </div>
        )}
      </div>
    </div>
  )
}
