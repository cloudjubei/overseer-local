import React, { useMemo, useRef, useState } from 'react'
import { PROJECT_ICONS, renderProjectIcon } from './projectIcons'
import { useGitHubCredentials } from '@renderer/contexts/GitHubCredentialsContext'
import { ProjectCodeInfoModal } from './ProjectCodeInfoModal'
import { CodeInfoChip } from './CodeInfoChip'
import { Switch } from '@renderer/components/ui/Switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/Select'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'

function TextInput({ label, value, onChange, placeholder, disabled, inputRef, action }: any) {
  const id = React.useId()
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <div className="flex gap-2 w-full">
        <input
          ref={inputRef}
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

function TextArea({ label, value, onChange, placeholder }: any) {
  const id = React.useId()
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="ui-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function IconPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  const currentKey = React.useMemo(() => {
    return value && PROJECT_ICONS[value] ? value : 'folder'
  }, [value])

  const currentLabel = PROJECT_ICONS[currentKey] || 'Folder'

  const iconEntries = React.useMemo(() => Object.entries(PROJECT_ICONS), [])

  return (
    <div className="form-row">
      <label>Icon</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Change icon (current: ${currentLabel})`}
          title={`Change icon (current: ${currentLabel})`}
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border bg-surface-raised hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span aria-hidden>{renderProjectIcon(currentKey, 'h-5 w-5')}</span>
        </button>
        <span className="text-sm text-text-secondary">{currentLabel}</span>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Choose icon" size="md">
        <div className="max-h-[60vh]">
          <div
            role="listbox"
            aria-label="Project icons"
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
                  role="option"
                  aria-selected={selected}
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

export type ProjectEditorFormProps = {
  mode: 'create' | 'edit'
  form: any
  setForm: React.Dispatch<React.SetStateAction<any>>
  formErrors: string[]
  formId: string
  onSubmit: (e: React.FormEvent) => void
  selectedGroupId: string | null
  onSelectedGroupIdChange: (groupId: string | null) => void
}

export function ProjectEditorForm({
  mode,
  form,
  setForm,
  formErrors,
  formId,
  onSubmit,
  selectedGroupId,
  onSelectedGroupIdChange,
}: ProjectEditorFormProps) {
  const { credentials } = useGitHubCredentials()
  const { groups } = useProjectsGroups()
  const [isCodeInfoModalOpen, setIsCodeInfoModalOpen] = useState(false)
  const idInputRef = useRef<HTMLInputElement>(null)

  // Separate MAIN and SCOPE groups for the two distinct UI controls
  const mainGroups = useMemo(() => groups.filter((g) => g.type === 'MAIN'), [groups])
  const scopeGroups = useMemo(() => groups.filter((g) => g.type === 'SCOPE'), [groups])

  const scopeGroupIds: string[] = useMemo(
    () => (Array.isArray(form.scopeGroupIds) ? form.scopeGroupIds : []),
    [form.scopeGroupIds],
  )

  function toggleScopeGroup(groupId: string) {
    setForm((s: any) => {
      const current: string[] = Array.isArray(s.scopeGroupIds) ? s.scopeGroupIds : []
      const next = current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
      return { ...s, scopeGroupIds: next }
    })
  }

  return (
    <form id={formId} className="story-form" onSubmit={onSubmit}>
      {formErrors.length > 0 && (
        <div role="alert" style={{ color: 'var(--status-stuck-fg)' }}>
          {formErrors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}

      {isCodeInfoModalOpen && (
        <ProjectCodeInfoModal
          codeInfo={form.codeInfo}
          onSave={(newCodeInfo) => {
            setForm((s: any) => ({ ...s, codeInfo: newCodeInfo }))
            setIsCodeInfoModalOpen(false)
          }}
          onClose={() => {
            setIsCodeInfoModalOpen(false)
            if (!form.codeInfo?.language) {
              setForm((s: any) => ({ ...s, codeInfo: undefined }))
            }
          }}
        />
      )}

      <TextInput
        label="ID"
        value={form.id}
        onChange={(v: string) => setForm((s: any) => ({ ...s, id: v }))}
        placeholder="unique-id"
        disabled={mode === 'edit'}
        inputRef={idInputRef}
      />

      {/* MAIN group — single dropdown */}
      <div className="form-row">
        <label>Main Group</label>
        <Select
          value={selectedGroupId ?? '__none__'}
          onValueChange={(v) => onSelectedGroupIdChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger className="ui-select w-full max-w-md">
            <SelectValue placeholder="Select main group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {mainGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* SCOPE groups — multi-select via checkboxes */}
      {scopeGroups.length > 0 && (
        <div className="form-row">
          <label>Scope Groups</label>
          <div className="flex flex-col gap-1.5 mt-0.5">
            {scopeGroups.map((g) => {
              const checked = scopeGroupIds.includes(g.id)
              return (
                <label
                  key={g.id}
                  className="flex items-center gap-2 cursor-pointer text-sm select-none"
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--accent-primary)] h-4 w-4 cursor-pointer"
                    checked={checked}
                    onChange={() => toggleScopeGroup(g.id)}
                  />
                  <span>{g.title}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      <TextInput
        label="Title"
        value={form.title}
        onChange={(v: string) => setForm((s: any) => ({ ...s, title: v }))}
        placeholder="Project title"
      />

      <TextArea
        label="Description"
        value={form.description}
        onChange={(v: string) => setForm((s: any) => ({ ...s, description: v }))}
        placeholder="Short description"
      />
      <TextInput
        label="Local Path"
        value={form.path}
        onChange={(v: string) => setForm((s: any) => ({ ...s, path: v }))}
        placeholder="/absolute/path/to/project"
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const p = await window.projectsService.selectDirectory()
              if (p) {
                setForm((s: any) => ({ ...s, path: p }))
              }
            }}
          >
            Browse...
          </Button>
        }
      />
      <TextInput
        label="Repository URL"
        value={form.repo_url}
        onChange={(v: string) => setForm((s: any) => ({ ...s, repo_url: v }))}
        placeholder="https://github.com/org/repo"
      />

      <div className="form-row flex items-center gap-4">
        <label htmlFor="active-project-switch">Active Project</label>
        <Switch
          key="active-project-switch"
          checked={form.active ?? true}
          onCheckedChange={(checked) => setForm((s: any) => ({ ...s, active: checked }))}
        />
      </div>

      <div className="form-row">
        <label>GitHub Credentials (optional)</label>
        <Select
          value={form.metadata.githubCredentialsId ?? '__none__'}
          onValueChange={(v) =>
            setForm((s: any) => ({
              ...s,
              metadata: { ...s.metadata, githubCredentialsId: v == '__none__' ? undefined : v },
            }))
          }
        >
          <SelectTrigger className="ui-select w-full max-w-md">
            <SelectValue placeholder="Select credentials" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {credentials.map((c) => (
              <SelectItem key={c.id} value={c.id!}>
                {c.name} ({c.username})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="form-row flex items-center gap-4">
        <label htmlFor="coding-project-switch">Coding Project</label>
        <Switch
          key="coding-project-switch"
          checked={!!form.codeInfo}
          onCheckedChange={(checked) => {
            if (checked) {
              setIsCodeInfoModalOpen(true)
            } else {
              setForm((s: any) => ({ ...s, codeInfo: undefined }))
            }
          }}
        />
      </div>

      {form.codeInfo && (
        <div className="form-row">
          <label>Code Info</label>
          <div className="flex gap-2">
            <CodeInfoChip
              type="language"
              value={form.codeInfo.language}
              isInteractive
              onClick={() => setIsCodeInfoModalOpen(true)}
            />
            {form.codeInfo.framework && (
              <CodeInfoChip
                type="framework"
                value={form.codeInfo.framework}
                isInteractive
                onClick={() => setIsCodeInfoModalOpen(true)}
              />
            )}
            {form.codeInfo.testFramework && (
              <CodeInfoChip
                type="testFramework"
                value={form.codeInfo.testFramework}
                isInteractive
                onClick={() => setIsCodeInfoModalOpen(true)}
              />
            )}
          </div>
        </div>
      )}

      <IconPicker
        value={form.metadata.icon}
        onChange={(v) => setForm((s: any) => ({ ...s, metadata: { ...s.metadata, icon: v } }))}
      />
    </form>
  )
}
