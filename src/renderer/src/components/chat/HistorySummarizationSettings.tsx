import type { CompletionHistorySummarization, CompletionSettings } from 'thefactory-tools'
import { Switch } from '@renderer/components/ui/Switch'

export type HistorySummarizationSettingsProps = {
  historySummarization?: CompletionHistorySummarization
  persistSettings: (patch: Partial<CompletionSettings>) => Promise<void>
}

export default function HistorySummarizationSettings({
  historySummarization,
  persistSettings,
}: HistorySummarizationSettingsProps) {
  const enabled = !!historySummarization?.enabled
  const keepLastTurns = historySummarization?.keepLastTurns ?? 4
  const maxOpsInSummary = historySummarization?.maxOpsInSummary ?? 30

  const patchSummarization = (patch: Partial<CompletionHistorySummarization>) => {
    const current: CompletionHistorySummarization = historySummarization ?? { enabled: false }
    void persistSettings({ historySummarization: { ...current, ...patch } })
  }

  return (
    <div className='space-y-3 pt-2 border-t border-[var(--border-subtle)]'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col'>
          <span className='text-xs font-medium text-[var(--text-secondary)]'>
            History Summarization
          </span>
          <span className='text-[10px] text-[var(--text-tertiary)]'>
            Summarize older messages to reduce token usage while preserving context
          </span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => patchSummarization({ enabled: !!checked })}
        />
      </div>

      {enabled && (
        <div className='space-y-3 pl-1'>
          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <label
                className='text-xs font-medium text-[var(--text-secondary)]'
                htmlFor='keepLastTurns'
              >
                Keep last turns:
                <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
                  {keepLastTurns}
                </span>
              </label>
            </div>
            <input
              id='keepLastTurns'
              type='range'
              min={1}
              max={20}
              step={1}
              value={keepLastTurns}
              onChange={(e) => patchSummarization({ keepLastTurns: Number(e.target.value) })}
              className='w-full'
            />
            <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <label
                className='text-xs font-medium text-[var(--text-secondary)]'
                htmlFor='maxOpsInSummary'
              >
                Max ops in summary:
                <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
                  {maxOpsInSummary}
                </span>
              </label>
            </div>
            <input
              id='maxOpsInSummary'
              type='range'
              min={5}
              max={100}
              step={5}
              value={maxOpsInSummary}
              onChange={(e) => patchSummarization({ maxOpsInSummary: Number(e.target.value) })}
              className='w-full'
            />
            <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
              <span>5</span>
              <span>100</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
