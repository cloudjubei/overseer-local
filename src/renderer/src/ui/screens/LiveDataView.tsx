import { useState } from 'react'
import {
  useActiveProject,
  useDataSources,
  emptySourceForm,
  sourceToForm,
  formToSourceInput,
  validateSourceForm,
  humanizeMs,
  isSourceFresh,
  type LiveDataSourceForm,
} from 'thefactory-ui/headless'
import type { DataSource, DataRecord } from 'thefactory-ui/headless/api'
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
} from 'thefactory-ui/web'
import { IconDelete, IconEdit, IconPlus } from 'thefactory-ui/web/icons'

function formatLastUpdated(ts: string | undefined): string {
  if (!ts) return 'never'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function summarizeContent(content: unknown): string {
  if (content && typeof content === 'object') {
    const latest = (content as { latest?: { v?: unknown; t?: unknown } }).latest
    if (latest && typeof latest === 'object' && 'v' in latest) {
      return `${String(latest.v)}${latest.t ? ` @ ${String(latest.t)}` : ''}`
    }
  }
  const json = JSON.stringify(content)
  return json.length > 80 ? `${json.slice(0, 80)}…` : json
}

type FormRoute = { mode: 'create' } | { mode: 'edit'; source: DataSource } | null

export default function LiveDataView() {
  const { projectId, project } = useActiveProject()
  const {
    isLoaded,
    loadError,
    sources,
    subscribedSourceIds,
    refreshing,
    createSource,
    updateSource,
    deleteSource,
    refreshSource,
    subscribe,
    unsubscribe,
    readSourceRecords,
  } = useDataSources()

  const [formRoute, setFormRoute] = useState<FormRoute>(null)
  const [deleting, setDeleting] = useState<DataSource | null>(null)

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
            Shared data sources. Subscribe {project?.title ?? 'this project'} to the ones its agents
            should see.
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setFormRoute({ mode: 'create' })}
          aria-label="Add data source"
          title="Add data source"
        >
          <IconPlus className="w-4 h-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-auto px-4 sm:px-8 py-6 flex flex-col gap-4">
        {loadError && <Alert variant="error">{loadError.message}</Alert>}

        {!isLoaded ? (
          <p className="text-sm opacity-60">Loading data sources…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm opacity-60">No data sources yet.</p>
        ) : (
          sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              subscribed={subscribedSourceIds.has(source.id)}
              refreshing={refreshing[source.id] === true}
              onSubscribe={() => subscribe(source.id)}
              onUnsubscribe={() => unsubscribe(source.id)}
              onRefresh={() => refreshSource(source.id)}
              onEdit={() => setFormRoute({ mode: 'edit', source })}
              onDelete={() => setDeleting(source)}
              readRecords={() => readSourceRecords(source.id)}
            />
          ))
        )}
      </div>

      {formRoute && (
        <SourceFormModal
          route={formRoute}
          onClose={() => setFormRoute(null)}
          onCreate={createSource}
          onUpdate={updateSource}
        />
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        title={deleting?.system ? 'Delete system provider?' : 'Delete data source?'}
        description={
          deleting?.system
            ? `"${deleting.name}" is a system provider that platform features depend on — deleting it can break them until it re-seeds on restart. Only continue if you know exactly what you're doing.`
            : `"${deleting?.name ?? ''}" and its fetched records will be removed. Every project subscribed to it loses this data.`
        }
        confirmLabel={deleting?.system ? 'Delete system provider' : 'Delete'}
        destructive
        onConfirm={async () => {
          if (deleting) await deleteSource(deleting.id, deleting.system === true)
          setDeleting(null)
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function SourceCard({
  source,
  subscribed,
  refreshing,
  onSubscribe,
  onUnsubscribe,
  onRefresh,
  onEdit,
  onDelete,
  readRecords,
}: {
  source: DataSource
  subscribed: boolean
  refreshing: boolean
  onSubscribe: () => Promise<unknown>
  onUnsubscribe: () => Promise<unknown>
  onRefresh: () => Promise<unknown>
  onEdit: () => void
  onDelete: () => void
  readRecords: () => Promise<DataRecord[]>
}) {
  const [expanded, setExpanded] = useState(false)
  const [records, setRecords] = useState<DataRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fresh = isSourceFresh(source)

  const toggleRecords = async () => {
    const next = !expanded
    setExpanded(next)
    if (next && records === null) {
      try {
        setRecords(await readRecords())
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const onRefreshClick = async () => {
    setError(null)
    try {
      await onRefresh()
      if (expanded) setRecords(await readRecords())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Surface className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{source.name}</span>
        <span className="badge badge--soft badge--queued text-[10px] uppercase tracking-wide">
          {source.recordType}
        </span>
        <span
          className={`badge badge--soft ${fresh ? 'badge--done' : 'badge--working'} text-[10px] uppercase tracking-wide`}
        >
          {fresh ? 'fresh' : 'stale'}
        </span>
        <span
          className={`badge badge--soft ${source.autoUpdate ? 'badge--done' : 'badge--empty'} text-[10px] uppercase tracking-wide`}
        >
          {source.autoUpdate ? 'auto' : 'manual'}
        </span>
        {source.system && (
          <span
            className="badge badge--soft badge--review text-[10px] uppercase tracking-wide"
            title="System provider — managed by the platform"
          >
            system
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={subscribed ? 'secondary' : 'primary'}
            onClick={subscribed ? onUnsubscribe : onSubscribe}
          >
            {subscribed ? 'Subscribed ✓' : 'Subscribe'}
          </Button>
          <Button
            variant="secondary"
            loading={refreshing}
            disabled={refreshing}
            onClick={onRefreshClick}
          >
            Update now
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
            <IconEdit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
            <IconDelete className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-(--text-secondary)">
        Freshness {humanizeMs(source.freshness)} · Last refreshed{' '}
        {formatLastUpdated(source.lastRefreshedAt)}
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      <div>
        <button
          type="button"
          className="text-xs text-(--accent) hover:underline"
          onClick={() => void toggleRecords()}
        >
          {expanded ? 'Hide records' : 'Show records'}
        </button>
        {expanded && (
          <div className="mt-2 max-h-80 overflow-auto rounded border border-(--border-subtle) bg-(--surface-muted) p-2 font-mono text-xs">
            {records === null ? (
              'Loading…'
            ) : records.length === 0 ? (
              'No records yet — try Update now.'
            ) : (
              <ul className="flex flex-col gap-1">
                {records.slice(0, 20).map((r, i) => (
                  <li key={r.key ? String(r.key) : i}>
                    <span className="text-(--text-secondary)">{r.key ? String(r.key) : '—'}</span>:{' '}
                    {summarizeContent(r.content)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Surface>
  )
}

function SourceFormModal({
  route,
  onClose,
  onCreate,
  onUpdate,
}: {
  route: { mode: 'create' } | { mode: 'edit'; source: DataSource }
  onClose: () => void
  onCreate: (input: ReturnType<typeof formToSourceInput>) => Promise<unknown>
  onUpdate: (id: string, patch: ReturnType<typeof formToSourceInput>) => Promise<unknown>
}) {
  const [form, setForm] = useState<LiveDataSourceForm>(
    route.mode === 'edit' ? sourceToForm(route.source) : emptySourceForm(),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // A system provider's wiring is managed by the platform; tunables (name,
  // freshness, auto-update) stay editable, but the fetch/mapping is read-only.
  const lockWiring = route.mode === 'edit' && route.source.system === true
  const set = <K extends keyof LiveDataSourceForm>(key: K, value: LiveDataSourceForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    const validation = validateSourceForm(form)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    try {
      const input = formToSourceInput(form)
      if (route.mode === 'edit') await onUpdate(route.source.id, input)
      else await onCreate(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      size="lg"
      title={route.mode === 'edit' ? 'Edit data source' : 'Add data source'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        {lockWiring && (
          <Alert variant="info">
            System provider — its fetch + data wiring is managed by the platform and locked. You can
            still rename it and adjust its refresh schedule.
          </Alert>
        )}
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="US stock prices"
          />
        </Field>
        <Field label="Record type">
          <Input
            value={form.recordType}
            onChange={(e) => set('recordType', e.target.value)}
            placeholder="stock-quote"
            disabled={lockWiring}
          />
        </Field>
        <div className="grid grid-cols-2 items-end gap-2">
          <Field label="Freshness">
            <Input
              type="number"
              min="1"
              value={form.freshnessValue}
              onChange={(e) => set('freshnessValue', e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <Select
              value={form.freshnessUnit}
              onChange={(e) =>
                set('freshnessUnit', e.target.value as LiveDataSourceForm['freshnessUnit'])
              }
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </Select>
          </Field>
        </div>
        <Switch
          checked={form.autoUpdate}
          onCheckedChange={(v) => set('autoUpdate', v)}
          label="Auto-update on a schedule"
        />
        <Field label="Fetch URL">
          <Input
            value={form.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://api.example.com/prices"
            disabled={lockWiring}
          />
        </Field>

        <div className="rounded border border-(--border-subtle)">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            <span>Advanced — how to read the response</span>
            <span className="text-(--text-secondary)">{showAdvanced ? '▾' : '▸'}</span>
          </button>
          {showAdvanced && (
            <div className="flex flex-col gap-3 border-t border-(--border-subtle) p-3">
              <p className="text-xs text-(--text-secondary)">
                Tells the platform how to read the fetched JSON. You only need these when building a
                custom source from a new URL.
              </p>
              <Field
                label="Items path"
                hint="Where the list of items sits in the response — e.g. products. Leave blank for the whole response."
              >
                <Input
                  value={form.itemsPath}
                  onChange={(e) => set('itemsPath', e.target.value)}
                  placeholder="data"
                  disabled={lockWiring}
                />
              </Field>
              <Field
                label="Kind"
                hint="sample = a number to track over time (builds history); snapshot = store each item as-is."
              >
                <Select
                  value={form.kind}
                  onChange={(e) => set('kind', e.target.value as LiveDataSourceForm['kind'])}
                  disabled={lockWiring}
                >
                  <option value="sample">sample (numeric → history)</option>
                  <option value="snapshot">snapshot (object stored as-is)</option>
                </Select>
              </Field>
              <Field
                label="Map: key"
                hint="The field that uniquely identifies each item, so a refresh updates the right row — e.g. symbol."
              >
                <Input
                  value={form.mapKey}
                  onChange={(e) => set('mapKey', e.target.value)}
                  placeholder="symbol"
                  disabled={lockWiring}
                />
              </Field>
              {form.kind === 'sample' && (
                <>
                  <Field
                    label="Map: value"
                    hint="The field holding the number to track — e.g. price."
                  >
                    <Input
                      value={form.mapValue}
                      onChange={(e) => set('mapValue', e.target.value)}
                      placeholder="price"
                      disabled={lockWiring}
                    />
                  </Field>
                  <Field
                    label="Map: time (optional)"
                    hint="The field holding each point's timestamp; defaults to the refresh time."
                  >
                    <Input
                      value={form.mapTime}
                      onChange={(e) => set('mapTime', e.target.value)}
                      placeholder="asOf"
                      disabled={lockWiring}
                    />
                  </Field>
                  <Field
                    label="History cap (optional)"
                    hint="Keep only the most recent N points per item."
                  >
                    <Input
                      type="number"
                      min="1"
                      value={form.historyCap}
                      onChange={(e) => set('historyCap', e.target.value)}
                      disabled={lockWiring}
                    />
                  </Field>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={saving}
            onClick={() => void submit()}
          >
            {route.mode === 'edit' ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
