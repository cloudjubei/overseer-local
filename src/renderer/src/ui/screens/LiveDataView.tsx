import { useState } from 'react'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useLiveDataProviders } from '@core/contexts/LiveDataProvidersContext'
import type {
  LiveDataProvider,
  LiveDataProviderCreateInput,
  LiveDataProviderEditInput,
} from 'thefactory-ui/headless/api'
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  NativeSelect as Select,
  Surface,
  Switch,
  Textarea,
} from 'thefactory-ui/web'
import { IconDelete, IconEdit, IconPlus } from 'thefactory-ui/web/icons'

type FreshnessPolicy = LiveDataProvider['freshnessPolicy']
type AutoTrigger = LiveDataProvider['autoUpdate']['trigger']
type Scope = LiveDataProvider['scope']

type ProviderForm = {
  name: string
  description: string
  url: string
  freshnessPolicy: FreshnessPolicy
  autoEnabled: boolean
  autoTrigger: AutoTrigger
  scope: Scope
}

const FRESHNESS_OPTIONS: FreshnessPolicy[] = ['daily', 'weekly', 'monthly']

const EMPTY_FORM: ProviderForm = {
  name: '',
  description: '',
  url: '',
  freshnessPolicy: 'daily',
  autoEnabled: true,
  autoTrigger: 'onAppLaunch',
  scope: 'project',
}

function urlFromConfig(config: unknown): string {
  if (typeof config !== 'object' || config === null) return ''
  const v = (config as Record<string, unknown>)['url']
  return typeof v === 'string' ? v : ''
}

function formToCreateInput(form: ProviderForm, projectId: string): LiveDataProviderCreateInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    freshnessPolicy: form.freshnessPolicy,
    autoUpdate: { enabled: form.autoEnabled, trigger: form.autoTrigger },
    scope: form.scope,
    ...(form.scope === 'project' ? { projectId } : {}),
    config: form.url.trim() ? { url: form.url.trim() } : {},
  }
}

function formToEditInput(form: ProviderForm): LiveDataProviderEditInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    freshnessPolicy: form.freshnessPolicy,
    autoUpdate: { enabled: form.autoEnabled, trigger: form.autoTrigger },
    scope: form.scope,
    config: form.url.trim() ? { url: form.url.trim() } : {},
  }
}

function providerToForm(p: LiveDataProvider): ProviderForm {
  return {
    name: p.name,
    description: p.description,
    url: urlFromConfig(p.config),
    freshnessPolicy: p.freshnessPolicy,
    autoEnabled: p.autoUpdate.enabled,
    autoTrigger: p.autoUpdate.trigger,
    scope: p.scope,
  }
}

function formatLastUpdated(ts: string | undefined): string {
  if (!ts) return 'never'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString()
}

type FormModalRoute = { mode: 'create' } | { mode: 'edit'; provider: LiveDataProvider } | null

export default function LiveDataView() {
  const { projectId, project } = useActiveProject()
  const {
    isLoaded,
    loadError,
    providers,
    createProvider,
    updateProvider,
    deleteProvider,
    fetchProvider,
    getProviderPayload,
  } = useLiveDataProviders()

  const [formModal, setFormModal] = useState<FormModalRoute>(null)
  const [pendingDelete, setPendingDelete] = useState<LiveDataProvider | null>(null)

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full opacity-60">
        <p className="text-sm">No project selected.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <header
        className="flex items-baseline justify-between gap-3 px-4 sm:px-8 py-5 border-b flex-wrap"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Live data</h1>
          <p className="text-xs opacity-60 mt-1">
            JSON sources fetched on a freshness schedule. Project-scoped + globals visible from{' '}
            {project?.title ?? 'this project'}.
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setFormModal({ mode: 'create' })}
          aria-label="Add live-data provider"
          title="Add live-data provider"
        >
          <IconPlus className="w-4 h-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-auto px-4 sm:px-8 py-6 flex flex-col gap-4">
        {loadError && <Alert>{loadError.message}</Alert>}
        {!isLoaded ? (
          <p className="text-sm opacity-60">Loading providers…</p>
        ) : providers.length === 0 ? (
          <p className="text-sm opacity-60">
            No live-data providers configured for this project yet.
          </p>
        ) : (
          providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onUpdate={(patch) => void updateProvider(p.id, patch)}
              onFetch={() => void fetchProvider(p.id)}
              onEdit={() => setFormModal({ mode: 'edit', provider: p })}
              onDelete={() => setPendingDelete(p)}
              loadPayload={() => getProviderPayload(p.id)}
            />
          ))
        )}
      </div>

      <ProviderFormModal
        route={formModal}
        onClose={() => setFormModal(null)}
        projectId={projectId}
        onCreate={async (input) => {
          await createProvider(input)
          setFormModal(null)
        }}
        onEdit={async (id, patch) => {
          await updateProvider(id, patch)
          setFormModal(null)
        }}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteProvider(pendingDelete.id)
        }}
        title="Delete live-data provider?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" and its cached payload will be removed.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}

function ProviderCard({
  provider,
  onUpdate,
  onFetch,
  onEdit,
  onDelete,
  loadPayload,
}: {
  provider: LiveDataProvider
  onUpdate: (patch: LiveDataProviderEditInput) => void
  onFetch: () => void
  onEdit: () => void
  onDelete: () => void
  loadPayload: () => Promise<{ data?: unknown } | null>
}) {
  const [showData, setShowData] = useState(false)
  const [data, setData] = useState<unknown>(undefined)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | undefined>(undefined)

  const toggleData = async () => {
    const next = !showData
    setShowData(next)
    if (next && data === undefined) await refreshData()
  }

  const refreshData = async () => {
    setDataLoading(true)
    setDataError(undefined)
    try {
      const payload = await loadPayload()
      setData(payload?.data ?? null)
    } catch (err) {
      setDataError(err instanceof Error ? err.message : String(err))
    } finally {
      setDataLoading(false)
    }
  }

  return (
    <Surface className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{provider.name}</span>
            <ScopeBadge scope={provider.scope} />
            <FreshnessBadge isFresh={provider.isFresh} />
          </div>
          {provider.description && (
            <p className="text-xs opacity-70 mt-1">{provider.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={() => void toggleData()}>
            {showData ? 'Hide data' : 'Show data'}
          </Button>
          <Button
            size="sm"
            onClick={onFetch}
            disabled={!!provider.isUpdating}
            loading={!!provider.isUpdating}
          >
            {provider.isUpdating ? 'Updating…' : 'Update now'}
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit} aria-label="Edit provider">
            <IconEdit className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} aria-label="Delete provider">
            <IconDelete className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="text-xs opacity-70">
        Last updated: {formatLastUpdated(provider.lastUpdated)}
      </div>

      {showData && (
        <div className="flex flex-col gap-2">
          {dataLoading ? (
            <p className="text-xs opacity-60">Loading latest data…</p>
          ) : dataError ? (
            <Alert>{dataError}</Alert>
          ) : (
            <pre
              className="max-h-80 overflow-auto rounded border p-2 text-xs font-mono"
              style={{
                background: 'var(--surface-muted)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {data == null ? 'No data cached yet.' : JSON.stringify(data, null, 2)}
            </pre>
          )}
          <Button size="sm" variant="link" onClick={() => void refreshData()}>
            Refresh data preview
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Freshness policy">
          <Select
            size="sm"
            value={provider.freshnessPolicy}
            onChange={(e) => onUpdate({ freshnessPolicy: e.target.value as FreshnessPolicy })}
          >
            {FRESHNESS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-col gap-2">
          <Switch
            checked={provider.autoUpdate.enabled}
            onCheckedChange={(checked) =>
              onUpdate({ autoUpdate: { ...provider.autoUpdate, enabled: checked } })
            }
            label="Automated checks"
          />
          {provider.autoUpdate.enabled && (
            <Field label="When">
              <Select
                size="sm"
                value={provider.autoUpdate.trigger}
                onChange={(e) =>
                  onUpdate({
                    autoUpdate: {
                      ...provider.autoUpdate,
                      trigger: e.target.value as AutoTrigger,
                    },
                  })
                }
              >
                <option value="onAppLaunch">On app launch</option>
                <option value="scheduled">On schedule</option>
              </Select>
            </Field>
          )}
        </div>
      </div>
    </Surface>
  )
}

function ScopeBadge({ scope }: { scope: Scope }) {
  const className =
    scope === 'project' ? 'badge badge--soft badge--queued' : 'badge badge--soft badge--empty'
  return <span className={`${className} text-[10px] uppercase tracking-wide`}>{scope}</span>
}

function FreshnessBadge({ isFresh }: { isFresh: boolean | undefined }) {
  const className = isFresh ? 'badge badge--soft badge--done' : 'badge badge--soft badge--working'
  return (
    <span className={`${className} text-[10px] uppercase tracking-wide`}>
      {isFresh ? 'fresh' : 'stale'}
    </span>
  )
}

function ProviderFormModal({
  route,
  onClose,
  projectId,
  onCreate,
  onEdit,
}: {
  route: FormModalRoute
  onClose: () => void
  projectId: string
  onCreate: (input: LiveDataProviderCreateInput) => Promise<void>
  onEdit: (id: string, patch: LiveDataProviderEditInput) => Promise<void>
}) {
  const initialForm = route?.mode === 'edit' ? providerToForm(route.provider) : EMPTY_FORM
  const isEdit = route?.mode === 'edit'

  const [form, setForm] = useState<ProviderForm>(initialForm)
  const [error, setError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  // Reset the form when the host opens it on a different route. Using the
  // provider id (or `'create'`) as a key on the modal would also work, but
  // this keeps the modal as a long-lived child to avoid a teardown flash.
  const routeKey = route?.mode === 'edit' ? `edit:${route.provider.id}` : 'create'
  const [lastKey, setLastKey] = useState(routeKey)
  if (lastKey !== routeKey) {
    setLastKey(routeKey)
    setForm(initialForm)
    setError(undefined)
  }

  const close = () => {
    setError(undefined)
    onClose()
  }

  const submit = async () => {
    setError(undefined)
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    if (form.url && !/^https?:\/\//i.test(form.url)) {
      setError('Fetch URL must start with http:// or https://')
      return
    }
    setSaving(true)
    try {
      if (route?.mode === 'edit') {
        await onEdit(route.provider.id, formToEditInput(form))
      } else {
        await onCreate(formToCreateInput(form, projectId))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={route !== null}
      onClose={close}
      title={isEdit ? 'Edit live-data provider' : 'Add live-data provider'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving} loading={saving}>
            {saving ? (isEdit ? 'Saving…' : 'Adding…') : isEdit ? 'Save changes' : 'Add provider'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Alert>{error}</Alert>}

        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Display name"
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this provider fetch?"
            rows={2}
          />
        </Field>

        <Field
          label="Fetch URL"
          hint="Optional. Stored on `config.url` for the generic JSON fetcher."
        >
          <Input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://example.com/data.json"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Freshness policy">
            <Select
              value={form.freshnessPolicy}
              onChange={(e) =>
                setForm({ ...form, freshnessPolicy: e.target.value as FreshnessPolicy })
              }
            >
              {FRESHNESS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Visibility">
            <Select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value as Scope })}
            >
              <option value="project">This project only</option>
              <option value="global">All projects (global)</option>
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <Switch
            checked={form.autoEnabled}
            onCheckedChange={(checked) => setForm({ ...form, autoEnabled: checked })}
            label="Automated checks"
          />
          {form.autoEnabled && (
            <Field label="When">
              <Select
                value={form.autoTrigger}
                onChange={(e) => setForm({ ...form, autoTrigger: e.target.value as AutoTrigger })}
              >
                <option value="onAppLaunch">On app launch</option>
                <option value="scheduled">On schedule</option>
              </Select>
            </Field>
          )}
        </div>
      </div>
    </Modal>
  )
}
