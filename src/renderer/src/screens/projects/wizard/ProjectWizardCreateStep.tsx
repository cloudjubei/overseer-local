import React, { useId, useState, useEffect, useMemo } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { IconFolder } from '@renderer/components/ui/icons/Icons'
import { PROJECT_ICONS, renderProjectIcon } from '../projectIcons'
import { Modal } from '@renderer/components/ui/Modal'
import { projectsService } from '@renderer/services/projectsService'

function TextInput({ label, value, onChange, placeholder, action, disabled }: any) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="flex gap-2 w-full">
        <input
          id={id}
          className="ui-input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {action}
      </div>
    </div>
  )
}

function IconPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  const currentKey = useMemo(() => {
    return value && PROJECT_ICONS[value] ? value : 'folder'
  }, [value])

  const currentLabel = PROJECT_ICONS[currentKey] || 'Folder'
  const iconEntries = useMemo(() => Object.entries(PROJECT_ICONS), [])

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-sm font-medium text-text-primary">Project Icon</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border bg-surface-raised hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          title={`Change icon (current: ${currentLabel})`}
        >
          <span aria-hidden>{renderProjectIcon(currentKey, 'h-5 w-5')}</span>
        </button>
        <span className="text-sm text-text-secondary">{currentLabel}</span>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Choose icon" size="md">
        <div className="max-h-[60vh] overflow-y-auto">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
            }}
          >
            {iconEntries.map(([key, label]) => {
              const selected = value === key
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onClick={() => {
                    onChange(key)
                    setIsOpen(false)
                  }}
                  className={
                    'inline-flex h-12 items-center justify-center rounded-md border text-sm ' +
                    (selected
                      ? 'border-brand-500 bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
                      : 'border-border bg-surface-raised hover:bg-surface-overlay')
                  }
                >
                  <span aria-hidden>{renderProjectIcon(key, 'h-5 w-5')}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export interface ProjectWizardCreateState {
  title: string
  id: string
  path: string
  icon: string
}

interface ProjectWizardCreateStepProps {
  initialState?: Partial<ProjectWizardCreateState>
  onStateChange: (state: ProjectWizardCreateState, isValid: boolean) => void
}

export function ProjectWizardCreateStep({ initialState, onStateChange }: ProjectWizardCreateStepProps) {
  const [title, setTitle] = useState(initialState?.title || '')
  const [id, setId] = useState(initialState?.id || '')
  const [path, setPath] = useState(initialState?.path || '')
  const [icon, setIcon] = useState(initialState?.icon || 'folder')
  const [autoId, setAutoId] = useState(true)

  useEffect(() => {
    if (autoId) {
      const generatedId = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      setId(generatedId)
    }
  }, [title, autoId])

  useEffect(() => {
    const isValid = title.trim() !== '' && id.trim() !== '' && path.trim() !== ''
    onStateChange({ title, id, path, icon }, isValid)
  }, [title, id, path, icon, onStateChange])

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto py-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2">Project Details</h2>
        <p className="text-text-secondary text-sm">
          Define the basic metadata and choose a local directory for your new project.
        </p>
      </div>

      <div className="bg-surface-raised p-6 rounded-xl border border-border">
        <TextInput
          label="Project Title"
          value={title}
          onChange={setTitle}
          placeholder="My Awesome App"
        />

        <TextInput
          label="Project ID"
          value={id}
          onChange={(v) => {
            setId(v)
            setAutoId(false)
          }}
          placeholder="my-awesome-app"
        />

        <TextInput
          label="Local Path"
          value={path}
          onChange={setPath}
          placeholder="/absolute/path/to/project"
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const p = await projectsService.selectDirectory()
                if (p) {
                  setPath(p)
                  if (!title && p.split(/[/\\]/).pop()) {
                     setTitle(p.split(/[/\\]/).pop() as string)
                  }
                }
              }}
            >
              <IconFolder className="w-4 h-4 mr-2" />
              Browse...
            </Button>
          }
        />

        <IconPicker value={icon} onChange={setIcon} />
      </div>
    </div>
  )
}
