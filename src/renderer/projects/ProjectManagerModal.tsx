import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { projectsService } from '../services/projectsService'
import { validateProjectClient } from './validateProject'
import { useProjectContext } from '../contexts/ProjectContext'
import { Button } from '../components/ui/Button'
import { PROJECT_ICONS, renderProjectIcon } from './projectIcons'
import { IconDelete, IconEdit, IconPlus } from '../components/ui/Icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { useGitHubCredentials } from '../contexts/GitHubCredentialsContext'

function TextInput({ label, value, onChange, placeholder, disabled }: any) {
  const id = React.useId()
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <input
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
  return (
    <div className="form-row">
      <label>Icon</label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
          gap: 6,
        }}
      >
        {PROJECT_ICONS.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.label}
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              style={{
                height: 36,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: selected
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-default)',
                background: selected
                  ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                  : 'var(--surface-raised)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <span aria-hidden>{renderProjectIcon(opt.value)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ProjectManagerModal({
  onRequestClose,
  initialMode,
  initialProjectId,
}: {
  onRequestClose?: () => void
  initialMode?: 'list' | 'create' | 'edit'
  initialProjectId?: string
}) {
  const { projects, getProjectById } = useProjectContext()
  const { credentials: creds } = useGitHubCredentials()
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>(initialMode || 'list')
  const [editingId, setEditingId] = useState<string | null>(initialProjectId || null)

  const [form, setForm] = useState<any>({
    id: '',
    title: '',
    description: '',
    path: '',
    repo_url: '',
    requirements: [],
    metadata: { icon: 'folder', githubCredentialsId: '' },
  })
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    // If we were asked to open in edit mode for a specific project, populate form
    if ((initialMode === 'edit' || mode === 'edit') && (initialProjectId || editingId)) {
      const id = (initialProjectId || editingId) as string
      const p: any = getProjectById(id)
      if (p) {
        const existingIcon = p.metadata?.icon
        const normalizedIcon = PROJECT_ICONS.some((opt) => opt.value === existingIcon)
          ? existingIcon
          : 'folder'
        setForm({
          ...p,
          requirements: Array.isArray(p.requirements) ? p.requirements : [],
          metadata: {
            ...(p.metadata ?? {}),
            icon: normalizedIcon,
            githubCredentialsId: p.metadata?.githubCredentialsId || '',
          },
        })
        setEditingId(id)
        setMode('edit')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialProjectId, getProjectById])

  const projectsList = useMemo(() => projects || [], [projects])

  function resetForm() {
    setForm({
      id: '',
      title: '',
      description: '',
      path: '',
      repo_url: '',
      requirements: [],
      metadata: { icon: 'folder', githubCredentialsId: '' },
    })
    setFormErrors([])
    setSaving(false)
    setEditingId(null)
  }

  function startCreate() {
    resetForm()
    setMode('create')
  }

  function startEdit(p: any) {
    const existingIcon = p.metadata?.icon
    const normalizedIcon = PROJECT_ICONS.some((opt) => opt.value === existingIcon)
      ? existingIcon
      : 'folder'
    setForm({
      ...p,
      requirements: Array.isArray(p.requirements) ? p.requirements : [],
      metadata: {
        ...(p.metadata ?? {}),
        icon: normalizedIcon,
        githubCredentialsId: p.metadata?.githubCredentialsId || '',
      },
    })
    setEditingId(p.id)
    setMode('edit')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project configuration?')) return
    setSaving(true)
    const res = await projectsService.deleteProject(id)
    if (!res.ok) {
      alert('Failed to delete: ' + (res.error || 'Unknown error'))
    }
    setSaving(false)
    setMode('list')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErrors([])

    // client-side validation
    const v = validateProjectClient(form)
    if (!v.valid) {
      setFormErrors(v.errors)
      return
    }

    // Additional: unique id on create
    if (mode === 'create' && projectsList.find((p: any) => p.id === form.id)) {
      setFormErrors([`Project id ${form.id} already exists`])
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        await projectsService.createProject(form)
      } else if (mode === 'edit' && editingId) {
        await projectsService.updateProject(editingId, form)
      }
    } catch (e: any) {
      setFormErrors([e?.message || String(e)])
      return
    } finally {
      setSaving(false)
    }
    setMode('list')
  }

  const formId = 'project-manager-form'

  return (
    <Modal
      title="Manage Projects"
      onClose={doClose}
      isOpen={true}
      size="lg"
      initialFocusRef={titleRef as React.RefObject<HTMLElement>}
      footer={
        mode === 'create' || mode === 'edit' ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setMode('list')}>
              Cancel
            </button>
            <button type="submit" className="btn" form={formId} disabled={saving}>
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        ) : null
      }
    >
      {error && (
        <div role="alert" style={{ color: 'var(--status-stuck-fg)' }}>
          Error: {error}
        </div>
      )}

      {mode === 'list' && (
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>Projects: {projectsList.length}</div>
            <Button className="btn-primary" onClick={() => startCreate()}>
              <IconPlus className="w-4 h-4" />
            </Button>
          </div>
          <div>
            {projectsList.length === 0 && <div className="empty">No child projects yet.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {projectsList.map((p: any) => (
                <li
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: '8px 0',
                  }}
                >
                  <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
                    <div aria-hidden>{renderProjectIcon(p.metadata?.icon)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p.id} · {p.path}
                      </div>
                    </div>
                  </div>
                  <div className="flex" style={{ gap: 8 }}>
                    <Button className="btn-secondary" onClick={() => startEdit(p)}>
                      <IconEdit className="w-4 h-4" />
                    </Button>
                    <Button
                      className="btn-secondary"
                      disabled={saving}
                      variant="danger"
                      onClick={() => handleDelete(p.id)}
                    >
                      <IconDelete className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <form id={formId} className="task-form" onSubmit={handleSubmit}>
          {formErrors.length > 0 && (
            <div role="alert" style={{ color: 'var(--status-stuck-fg)' }}>
              {formErrors.map((e, i) => (
                <div key={i}>• {e}</div>
              ))}
            </div>
          )}
          <TextInput
            label="ID"
            value={form.id}
            onChange={(v: string) => setForm((s: any) => ({ ...s, id: v }))}
            placeholder="unique-id"
            disabled={mode === 'edit'}
          />
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
                {creds.map((c) => (
                  <SelectItem key={c.id} value={c.id!}>
                    {c.name} ({c.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <IconPicker
            value={form.metadata.icon}
            onChange={(v) => setForm((s: any) => ({ ...s, metadata: { ...s.metadata, icon: v } }))}
          />
        </form>
      )}
    </Modal>
  )
}
