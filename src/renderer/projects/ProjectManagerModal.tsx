import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { projectsService } from '../services/projectsService'
import { validateProjectClient } from './validateProject'

function TextInput({ label, value, onChange, placeholder, disabled }: any) {
  const id = React.useId()
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder }: any) {
  const id = React.useId()
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="ui-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export default function ProjectManagerModal({ onRequestClose }: { onRequestClose?: () => void}) {
  const [snapshot, setSnapshot] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<any>({ id: '', title: '', description: '', path: '', repo_url: '', requirements: [] })
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await projectsService.getSnapshot()
        if (!cancelled) { setSnapshot(snap); setLoading(false) }
      } catch (e: any) {
        if (!cancelled) { setError(String(e?.message || e)); setLoading(false) }
      }
    })()
    const unsub = projectsService.onUpdate(setSnapshot)
    return () => { cancelled = true; unsub() }
  }, [])

  const projects = useMemo(() => {
    if (!snapshot) return []
    return snapshot.orderedIds.map((id: string) => snapshot.projectsById[id]).filter(Boolean)
  }, [snapshot])

  function resetForm() {
    setForm({ id: '', title: '', description: '', path: '', repo_url: '', requirements: [] })
    setFormErrors([])
    setSaving(false)
  }

  function startCreate() {
    resetForm()
    setMode('create')
  }

  function startEdit(p: any) {
    setForm({ ...p, requirements: Array.isArray(p.requirements) ? p.requirements : [] })
    setEditingId(p.id)
    setMode('edit')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project configuration?')) return
    setSaving(true)
    const res = await projectsService.remove(id)
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
    if (!v.valid) { setFormErrors(v.errors); return }

    // Additional: unique id on create
    if (mode === 'create' && snapshot?.projectsById?.[form.id]) {
      setFormErrors([`Project id ${form.id} already exists`])
      return
    }

    setSaving(true)
    let res
    if (mode === 'create') {
      res = await projectsService.create(form)
    } else if (mode === 'edit' && editingId) {
      res = await projectsService.update(editingId, form)
    }
    setSaving(false)
    if (!res?.ok) {
      setFormErrors([res?.error || 'Failed to save'])
      return
    }
    setMode('list')
  }

  return (
    <Modal title="Manage Projects" onClose={doClose} isOpen={true} size="lg" initialFocusRef={titleRef as React.RefObject<HTMLElement>}>
      {loading && <div>Loading…</div>}
      {error && <div role="alert" style={{ color: 'var(--status-stuck-fg)' }}>Error: {error}</div>}

      {mode === 'list' && !loading && !error && (
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>Projects: {projects.length}</div>
            <button className="btn" onClick={startCreate}>New Project</button>
          </div>
          <div>
            {projects.length === 0 && <div className="empty">No child projects yet.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {projects.map((p: any) => (
                <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.id} · {p.path}</div>
                  </div>
                  <div className="flex" style={{ gap: 8 }}>
                    <button className="btn-secondary" onClick={() => startEdit(p)}>Edit</button>
                    <button className="btn-secondary" disabled={saving} onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <form className="task-form" onSubmit={handleSubmit}>
          {formErrors.length > 0 && (
            <div role="alert" style={{ color: 'var(--status-stuck-fg)' }}>
              {formErrors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
          <TextInput label="ID" value={form.id} onChange={(v: string) => setForm((s: any) => ({ ...s, id: v }))} placeholder="unique-id" disabled={mode === 'edit'} />
          <TextInput label="Title" value={form.title} onChange={(v: string) => setForm((s: any) => ({ ...s, title: v }))} placeholder="Project title" />
          <TextArea label="Description" value={form.description} onChange={(v: string) => setForm((s: any) => ({ ...s, description: v }))} placeholder="Short description" />
          <TextInput label="Path (under projects/)" value={form.path} onChange={(v: string) => setForm((s: any) => ({ ...s, path: v }))} placeholder="my-project" />
          <TextInput label="Repository URL" value={form.repo_url} onChange={(v: string) => setForm((s: any) => ({ ...s, repo_url: v }))} placeholder="https://github.com/org/repo" />
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setMode('list')}>Cancel</button>
            <button type="submit" className="btn" disabled={saving}>{mode === 'create' ? 'Create' : 'Save'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
