import React, { useMemo, useRef, useState } from 'react'
import { PROJECT_ICONS, PROJECT_ICON_REGISTRY, renderProjectIcon } from './projectIcons'
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

function TextInput({ label, value, onChange, placeholder, disabled, inputRef }: any) {
  const id = React.useId()
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        className="ui-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
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

  const current = React.useMemo(() => {
    return (
      PROJECT_ICONS.find((i) => i.value === value) ||
      PROJECT_ICONS.find((i) => i.value === 'folder') ||
      PROJECT_ICONS[0]
    )
  }, [value])

  return (
    <div className="form-row">
      <label>Icon</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={current ? `Change icon (current: ${current.label})` : 'Change icon'}
          title={current ? `Change icon (current: ${current.label})` : 'Change icon'}
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-border bg-surface-raised hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span aria-hidden>{renderProjectIcon(current?.value, 'h-5 w-5')}</span>
        </button>
        {current && <span className="text-sm text-text-secondary">{current.label}</span>}
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
            {PROJECT_ICONS.map((opt) => {
              const selected = value === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={opt.label}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={
                    'inline-flex h-12 items-center justify-center rounded-md border text-sm ' +
                    (selected
                      ? 'border-brand-500 bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
                      : 'border-border bg-surface-raised hover:bg-surface-overlay')
                  }
                >
                  <span aria-hidden>{renderProjectIcon(opt.value, 'h-5 w-5')}</span>
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

  const groupsOptions = useMemo(() => groups, [groups])

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

      <div className="form-row">
        <label>Group</label>
        <Select
          value={selectedGroupId ?? '__none__'}
          onValueChange={(v) => onSelectedGroupIdChange(v === '__none__' ? null : v)}
        >
          <SelectTrigger className="ui-select w-full max-w-md">
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Uncategorized</SelectItem>
            {groupsOptions.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        label="Path (under projects/)"
        value={form.path}
        onChange={(v: string) => setForm((s: any) => ({ ...s, path: v }))}
        placeholder="my-project"
      />
      <TextInput
        label="Repository URL"
        value={form.repo_url}
        onChange={(v: string) => setForm((s: any) => ({ ...s, repo_url: v }))}
        placeholder="https://github.com/org/repo"
      />

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
