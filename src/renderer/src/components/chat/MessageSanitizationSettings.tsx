import type { CompletionMessageSanitization, CompletionSettings } from 'thefactory-tools'

import { Switch } from '@renderer/components/ui/Switch'

export default function MessageSanitizationSettings({
  messageSanitization,
  persistSettings,
}: {
  messageSanitization?: CompletionMessageSanitization
  persistSettings: (patch: Partial<CompletionSettings>) => Promise<void>
}) {
  const effectiveEnabled = messageSanitization?.enabled ?? false
  const effectiveKeepLast = messageSanitization?.keepLastMessages ?? 8

  return (
    <div className='space-y-3 pt-2 border-t border-[var(--border-subtle)]'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col'>
          <span className='text-xs font-medium text-[var(--text-secondary)]'>
            Message sanitization
          </span>
          <span className='text-[10px] text-[var(--text-tertiary)]'>
            Clamp very large tool outputs/arguments before sending to the LLM
          </span>
        </div>
        <Switch
          checked={effectiveEnabled}
          onCheckedChange={(checked) =>
            persistSettings({
              messageSanitization: {
                ...(messageSanitization ?? {}),
                enabled: !!checked,
                keepLastMessages: effectiveKeepLast,
              },
            })
          }
        />
      </div>

      <div className='space-y-1'>
        <div className='flex items-center justify-between'>
          <label
            className='text-xs font-medium text-[var(--text-secondary)]'
            htmlFor='keepLastMessages'
          >
            Keep last messages:
            <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
              {effectiveKeepLast}
            </span>
          </label>
        </div>

        <input
          id='keepLastMessages'
          type='range'
          min={0}
          max={30}
          step={1}
          value={effectiveKeepLast}
          onChange={(e) =>
            persistSettings({
              messageSanitization: {
                ...(messageSanitization ?? {}),
                enabled: effectiveEnabled,
                keepLastMessages: Number(e.target.value),
              },
            })
          }
          className='w-full'
          disabled={!effectiveEnabled}
        />

        <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
          <span>0</span>
          <span>30</span>
        </div>
      </div>
    </div>
  )
}
