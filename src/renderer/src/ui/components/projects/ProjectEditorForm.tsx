import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  CodeInfoChip,
  Field,
  Input,
  Modal,
  PROJECT_ICONS,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  renderProjectIcon,
} from 'thefactory-ui/web'
import type { GetProjectResponse, UpdateProjectData } from '@generated/backend'
import { useGitCredentials } from '@core/contexts/GitCredentialsContext'
import { useProjectsGroups } from '@core/contexts/ProjectsGroupsContext'
import ProjectCodeInfoModal, { type CodeInfoValue } from './ProjectCodeInfoModal'

export type ProjectFormState = {
  id: string
  title: string
  description: string
  repo_url: string
  active: boolean
  metadata: { icon: string; githubCredentialsId?: string }
  codeInfo?: NonNullable<UpdateProjectData['body']['codeInfo']>
  /**
   * `null` is the explicit "no main group" choice — must round-trip to
   * the backend as `null` so the spec actually clears (the backend
   * treats `undefined` as "leave alone"). `undefined` only appears here
   * for a brand-new form before the user has touched the field.
   */
  mainGroupId?: string | null
  scopeGroupIds: string[]
}

export function blankProjectForm(): ProjectFormState {
  return {
    id: '',
    title: '',
    description: '',
    repo_url: '',
    active: true,
    metadata: { icon: 'folder' },
    scopeGroupIds: [],
  }
}

export function projectToFormState(p: GetProjectResponse): ProjectFormState {
  const md = (p.metadata ?? {}) as Record<string, unknown>
  const iconKey = typeof md.icon === 'string' && md.icon in PROJECT_ICONS ? md.icon : 'folder'
  const credsId = typeof md.githubCredentialsId === 'string' ? md.githubCredentialsId : undefined
  // `codeInfo` and `mainGroupId` may be on the spec when the backend joined
  // them in; cast through `unknown` since `GetProjectResponse` doesn't carry
  // them in its base shape.
  const anyP = p as unknown as Record<string, unknown>
  return {
    id: p.id,
    title: p.title ?? '',
    description: p.description ?? '',
    repo_url: p.repo_url ?? '',
    active: p.active !== false,
    metadata: { icon: iconKey, githubCredentialsId: credsId },
    codeInfo: anyP.codeInfo as ProjectFormState['codeInfo'],
    mainGroupId: typeof anyP.mainGroupId === 'string' ? (anyP.mainGroupId as string) : undefined,
    scopeGroupIds: Array.isArray(anyP.scopeGroupIds) ? (anyP.scopeGroupIds as string[]) : [],
  }
}

export type ProjectEditorFormProps = {
  mode: 'create' | 'edit'
  form: ProjectFormState
  setForm: (next: ProjectFormState | ((prev: ProjectFormState) => ProjectFormState)) => void
  formErrors: string[]
  formId: string
  onSubmit: (e: FormEvent) => void
}

export function ProjectEditorForm({
  mode,
  form,
  setForm,
  formErrors,
  formId,
  onSubmit,
}: ProjectEditorFormProps) {
  const { credentials } = useGitCredentials()
  const { groups } = useProjectsGroups()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [codeInfoOpen, setCodeInfoOpen] = useState(false)

  const mainGroups = useMemo(() => groups.filter((g) => g.type === 'MAIN'), [groups])
  const scopeGroups = useMemo(() => groups.filter((g) => g.type === 'SCOPE'), [groups])

  const toggleScopeGroup = (groupId: string) => {
    setForm((s) => {
      const current = s.scopeGroupIds ?? []
      const next = current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
      return { ...s, scopeGroupIds: next }
    })
  }

  const iconKey = form.metadata.icon in PROJECT_ICONS ? form.metadata.icon : 'folder'
  const iconLabel = PROJECT_ICONS[iconKey] ?? 'Folder'
  const iconEntries = useMemo(() => Object.entries(PROJECT_ICONS), [])

  return (
    <form id={formId} className="flex flex-col gap-4" onSubmit={onSubmit}>
      {formErrors.length > 0 && (
        <Alert>
          {formErrors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </Alert>
      )}

      <Field label="ID" hint={mode === 'edit' ? 'IDs are immutable after creation.' : undefined}>
        <Input
          value={form.id}
          onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))}
          placeholder="unique-id"
          disabled={mode === 'edit'}
          spellCheck={false}
        />
      </Field>

      <Field label="Main Group">
        <Select
          value={form.mainGroupId ?? '__none__'}
          onValueChange={(v) =>
            setForm((s) => ({ ...s, mainGroupId: v === '__none__' ? null : v }))
          }
        >
          <SelectTrigger>
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
      </Field>

      {scopeGroups.length > 0 && (
        <Field label="Scope Groups">
          <div className="flex flex-col gap-1.5 mt-0.5">
            {scopeGroups.map((g) => {
              const checked = form.scopeGroupIds.includes(g.id)
              return (
                <label
                  key={g.id}
                  className="flex items-center gap-2 cursor-pointer text-sm select-none"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-(--accent-primary)"
                    checked={checked}
                    onChange={() => toggleScopeGroup(g.id)}
                  />
                  <span>{g.title}</span>
                </label>
              )
            })}
          </div>
        </Field>
      )}

      <Field label="Title">
        <Input
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          placeholder="Project title"
        />
      </Field>

      <Field label="Description">
        <Textarea
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          placeholder="Short description"
          rows={3}
        />
      </Field>

      <Field label="Repository URL">
        <Input
          value={form.repo_url}
          onChange={(e) => setForm((s) => ({ ...s, repo_url: e.target.value }))}
          placeholder="https://github.com/owner/repo"
          spellCheck={false}
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Active Project</span>
        <Switch
          checked={form.active}
          onCheckedChange={(checked) => setForm((s) => ({ ...s, active: checked }))}
        />
      </div>

      <Field label="GitHub Credentials (optional)">
        <Select
          value={form.metadata.githubCredentialsId ?? '__none__'}
          onValueChange={(v) =>
            setForm((s) => ({
              ...s,
              metadata: {
                ...s.metadata,
                githubCredentialsId: v === '__none__' ? undefined : v,
              },
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select credentials" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {credentials.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.username})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Coding Project</span>
        <Switch
          checked={!!form.codeInfo}
          onCheckedChange={(checked) => {
            if (checked) {
              // Open the picker — only commit a codeInfo to the form when the
              // user saves it. If they cancel without picking a language,
              // we leave codeInfo undefined and the toggle stays off.
              setCodeInfoOpen(true)
            } else {
              setForm((s) => ({ ...s, codeInfo: undefined }))
            }
          }}
        />
      </div>

      {form.codeInfo && (
        <div className="flex flex-wrap gap-2">
          <CodeInfoChip
            type="language"
            value={form.codeInfo.language}
            isInteractive
            onClick={() => setCodeInfoOpen(true)}
          />
          {form.codeInfo.framework && (
            <CodeInfoChip
              type="framework"
              value={form.codeInfo.framework}
              isInteractive
              onClick={() => setCodeInfoOpen(true)}
            />
          )}
          {form.codeInfo.testFramework && (
            <CodeInfoChip
              type="testFramework"
              value={form.codeInfo.testFramework}
              isInteractive
              onClick={() => setCodeInfoOpen(true)}
            />
          )}
        </div>
      )}

      {codeInfoOpen && (
        <ProjectCodeInfoModal
          codeInfo={form.codeInfo as Partial<CodeInfoValue> | undefined}
          onSave={(next) => {
            // `next.framework` / `next.testFramework` are typed as `string`
            // from the modal but the SDK uses a strict union. The modal only
            // surfaces values from the per-language registries, so this cast
            // is safe at runtime.
            setForm((s) => ({
              ...s,
              codeInfo: next as ProjectFormState['codeInfo'],
            }))
            setCodeInfoOpen(false)
          }}
          onClose={() => setCodeInfoOpen(false)}
        />
      )}

      <div>
        <span className="block text-sm font-medium mb-1">Icon</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Change icon (current: ${iconLabel})`}
            title={`Change icon (current: ${iconLabel})`}
            onClick={() => setIconPickerOpen(true)}
            className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-(--border-default) bg-(--surface-raised) hover:bg-(--surface-muted)"
          >
            <span aria-hidden>{renderProjectIcon(iconKey, 'h-5 w-5')}</span>
          </button>
          <span className="text-sm text-(--text-secondary)">{iconLabel}</span>
        </div>
      </div>

      <Modal
        isOpen={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        title="Choose icon"
        size="md"
      >
        <div
          role="listbox"
          aria-label="Project icons"
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}
        >
          {iconEntries.map(([key, label]) => {
            const selected = iconKey === key
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selected}
                title={label}
                onClick={() => {
                  setForm((s) => ({ ...s, metadata: { ...s.metadata, icon: key } }))
                  setIconPickerOpen(false)
                }}
                className={`inline-flex h-12 items-center justify-center rounded-md border text-sm ${
                  selected
                    ? 'border-(--accent-primary) bg-(--surface-muted)'
                    : 'border-(--border-default) bg-(--surface-raised) hover:bg-(--surface-muted)'
                }`}
              >
                <span aria-hidden>{renderProjectIcon(key, 'h-5 w-5')}</span>
              </button>
            )
          })}
        </div>
      </Modal>
    </form>
  )
}
