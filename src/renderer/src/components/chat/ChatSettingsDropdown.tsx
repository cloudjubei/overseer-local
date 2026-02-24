import { useEffect, useRef } from 'react'
import type { ChatContext, CompletionSettings } from 'thefactory-tools'

import { Button } from '@renderer/components/ui/Button'
import { Switch } from '@renderer/components/ui/Switch'

export type ToolToggle = {
  name: string
  description: string
  available: boolean
  autoCall: boolean
}

export type ChatSettingsDropdownProps = {
  isOpen: boolean
  onClose: () => void

  context: ChatContext

  completion?: {
    maxTurns?: number
    numberMessagesToSend?: number
    finishTurnOnErrors?: boolean
  }

  draftPrompt: string
  setDraftPrompt: (v: string) => void
  onSavePrompt: () => Promise<void>
  onResetPrompt: () => Promise<void>

  tools: ToolToggle[]
  toggleAvailable: (tool: ToolToggle) => Promise<void>
  toggleAutoCall: (tool: ToolToggle) => Promise<void>

  persistSettings: (patch: Partial<CompletionSettings>) => Promise<void>

  onDeleteChat: () => Promise<void>

  settingsBtnRef: React.RefObject<HTMLButtonElement | null>
}

export default function ChatSettingsDropdown({
  isOpen,
  onClose,
  completion,
  draftPrompt,
  setDraftPrompt,
  onSavePrompt,
  onResetPrompt,
  tools,
  toggleAvailable,
  toggleAutoCall,
  persistSettings,
  onDeleteChat,
  settingsBtnRef,
}: ChatSettingsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (!isOpen) return
      if (dropdownRef.current && dropdownRef.current.contains(t)) return
      if (settingsBtnRef.current && settingsBtnRef.current.contains(t)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (!isOpen) return
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose, settingsBtnRef])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className='absolute top-full right-3 left-3 mt-2 w-auto max-w-[520px] ml-auto rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-xl z-50'
      role='menu'
      aria-label='Chat Settings'
    >
      <div className='px-3 py-2 border-b border-[var(--border-subtle)]'>
        <div className='text-sm font-semibold text-[var(--text-primary)]'>Chat Settings</div>
        <div className='text-xs text-[var(--text-secondary)]'>Controls for this chat</div>
      </div>

      <div className='p-3 space-y-4 max-h-[70vh] overflow-auto'>
        <div className='space-y-2'>
          <div className='text-xs font-medium text-[var(--text-secondary)]'>System Prompt</div>
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            className='w-full min-h-[100px] p-2 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-md text-sm'
            placeholder='Custom system prompt for this chat context...'
          />
          <div className='flex items-center gap-2'>
            <button className='btn' onClick={onSavePrompt}>
              Save prompt
            </button>
            <button className='btn-secondary' onClick={onResetPrompt}>
              Reset to defaults
            </button>
          </div>
        </div>

        {completion ? (
          <div className='space-y-3'>
            <div className='space-y-1'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-medium text-[var(--text-secondary)]' htmlFor='maxTurns'>
                  Max turns per run:
                  <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
                    {completion.maxTurns ?? ''}
                  </span>
                </label>
              </div>
              <input
                id='maxTurns'
                type='range'
                min={1}
                max={100}
                step={1}
                value={completion.maxTurns ?? 1}
                onChange={(e) => persistSettings({ maxTurns: Number(e.target.value) })}
                className='w-full'
              />
              <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            <div className='space-y-1'>
              <div className='flex items-center justify-between'>
                <label
                  className='text-xs font-medium text-[var(--text-secondary)]'
                  htmlFor='numberMessagesToSend'
                >
                  Number of messages to send:
                  <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
                    {completion.numberMessagesToSend ?? ''}
                  </span>
                </label>
              </div>
              <input
                id='numberMessagesToSend'
                type='range'
                min={3}
                max={50}
                step={1}
                value={completion.numberMessagesToSend ?? 3}
                onChange={(e) =>
                  persistSettings({
                    numberMessagesToSend: Number(e.target.value),
                  })
                }
                className='w-full'
              />
              <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
                <span>3</span>
                <span>20</span>
              </div>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex flex-col'>
                <span className='text-xs font-medium text-[var(--text-secondary)]'>
                  Finish turn on errors
                </span>
                <span className='text-[10px] text-[var(--text-tertiary)]'>
                  When enabled, the agent ends the current turn if a tool call errors
                </span>
              </div>
              <Switch
                checked={!!completion.finishTurnOnErrors}
                onCheckedChange={(checked) => persistSettings({ finishTurnOnErrors: !!checked })}
              />
            </div>
          </div>
        ) : null}

        <div className='space-y-2'>
          <div className='text-xs font-medium text-[var(--text-secondary)]'>Tools</div>
          <div className='rounded-md border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]'>
            {tools.length === 0 ? (
              <div className='text-xs text-[var(--text-secondary)] px-2 py-3'>
                No tools available for this context.
              </div>
            ) : (
              tools.map((tool) => (
                <div key={tool.name} className='px-2 py-2 space-y-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <div className='flex-1 min-w-0 pr-2'>
                      <div className='text-sm text-[var(--text-primary)] truncate'>{tool.name}</div>
                      <div className='text-xs text-neutral-500 font-light truncate'>
                        {tool.description}
                      </div>
                    </div>
                    <div className='flex flex-col items-center gap-1'>
                      <div className='flex flex-col items-center space-y-px'>
                        <span className='text-[10px] text-[var(--text-secondary)]'>Available</span>
                        <Switch
                          checked={tool.available}
                          onCheckedChange={() => void toggleAvailable(tool)}
                        />
                      </div>
                      <div className='flex flex-col items-center space-y-px'>
                        <span className='text-[10px] text-[var(--text-secondary)]'>Auto-call</span>
                        <Switch
                          checked={tool.available ? tool.autoCall : false}
                          onCheckedChange={() => void toggleAutoCall(tool)}
                          disabled={!tool.available}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='pt-2 border-t border-[var(--border-subtle)]'>
          <Button variant='danger' onClick={() => void onDeleteChat()}>
            Delete this chat
          </Button>
        </div>
      </div>
    </div>
  )
}
