import { useMemo, useState } from 'react'
import { useTools } from '@core/contexts/ToolsContext'
import type { ToolDescriptor, ToolExecuteResult, ToolPreviewResult } from '@api/types'
import {
  Alert,
  Button,
  CopyButton,
  Field,
  Input,
  NativeSelect,
  Spinner,
  Surface,
  Textarea,
} from 'thefactory-ui/web'
import { IconChevron } from 'thefactory-ui/web/icons'
import { formatJson } from '@ui/utils/json'

type ResultView =
  | { kind: 'preview'; result: ToolPreviewResult; durationMs: number }
  | { kind: 'execute'; result: ToolExecuteResult }
  | null

const STATUS_COLOR: Record<ToolExecuteResult['type'], string> = {
  success: 'var(--color-green-700)',
  errored: 'var(--color-red-700)',
  not_allowed: 'var(--color-red-700)',
  aborted: 'var(--color-orange-700)',
  pending: 'var(--color-gray-700)',
  running: 'var(--color-blue-700)',
  require_confirmation: 'var(--color-orange-700)',
}

const PANEL_COLLAPSED_LS_KEY = 'thefactory-overseer-web:tools.panelCollapsed'

export default function ToolsView() {
  const { isLoaded, loadError, tools, executeTool, previewTool } = useTools()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [args, setArgs] = useState<Record<string, unknown>>({})
  const [opError, setOpError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'preview' | 'execute' | null>(null)
  const [result, setResult] = useState<ResultView>(null)
  const [filter, setFilter] = useState('')
  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(() => readCollapsed())

  const grouped = useMemo(() => groupByCategory(tools, filter), [tools, filter])
  const selected = tools.find((t) => t.name === selectedName) ?? null
  const selectedProps = getProperties(selected?.parameters)
  const selectedRequired = getRequired(selected?.parameters)

  const togglePanelCollapsed = () => {
    setPanelCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(PANEL_COLLAPSED_LS_KEY, next ? '1' : '0')
      } catch {
        // best-effort
      }
      return next
    })
  }

  const onSelect = (name: string) => {
    setSelectedName(name)
    setArgs({})
    setOpError(null)
    setResult(null)
  }

  const onArgChange = (key: string, value: unknown, schema: unknown) => {
    setArgs((prev) => ({ ...prev, [key]: coerceValue(schema, value) }))
  }

  const onPreview = async () => {
    if (!selected) return
    setBusy('preview')
    setOpError(null)
    const startedAt = performance.now()
    try {
      const result = await previewTool(selected.name, args)
      const durationMs = Math.round(performance.now() - startedAt)
      setResult({ kind: 'preview', result, durationMs })
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to preview')
    } finally {
      setBusy(null)
    }
  }

  const onExecute = async () => {
    if (!selected) return
    setBusy('execute')
    setOpError(null)
    try {
      const result = await executeTool(selected.name, args)
      setResult({ kind: 'execute', result })
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Failed to execute')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <aside
        className="shrink-0 flex flex-col border-r overflow-hidden transition-[width]"
        style={{
          width: panelCollapsed ? 48 : '33%',
          minWidth: panelCollapsed ? 48 : 280,
          maxWidth: panelCollapsed ? 48 : 520,
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-base)',
        }}
      >
        <div
          className={`flex items-center gap-2 px-2 py-2 shrink-0 ${
            panelCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!panelCollapsed && (
            <Input
              placeholder="Filter tools…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              size="sm"
              className="flex-1"
            />
          )}
          <button
            type="button"
            onClick={togglePanelCollapsed}
            aria-label={panelCollapsed ? 'Expand tools list' : 'Collapse tools list'}
            title={panelCollapsed ? 'Expand tools list' : 'Collapse tools list'}
            className="p-1 rounded text-(--text-muted) hover:text-(--text-primary) hover:bg-black/5 dark:hover:bg-white/10"
          >
            <IconChevron
              className="w-4 h-4"
              style={{ transform: panelCollapsed ? undefined : 'rotate(180deg)' }}
            />
          </button>
        </div>
        {!panelCollapsed && (
          <div className="flex-1 overflow-auto px-3 py-2 flex flex-col gap-5">
            {!isLoaded && (
              <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                <Spinner />
                Loading tools…
              </div>
            )}
            {loadError && <Alert>{loadError.message}</Alert>}
            {isLoaded &&
              grouped.map(({ category, items }) => (
                <div key={category} className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold uppercase tracking-wide text-(--text-secondary)">
                    {category}
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {items.map((tool) => (
                      <ToolListCard
                        key={tool.name}
                        tool={tool}
                        isActive={tool.name === selectedName}
                        onClick={() => onSelect(tool.name)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            {isLoaded && grouped.length === 0 && (
              <p className="text-sm text-(--text-secondary)">
                No tools{filter ? ' match your filter.' : '.'}
              </p>
            )}
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 overflow-auto p-6 flex flex-col gap-3">
        {opError && <Alert>{opError}</Alert>}
        {selected ? (
          <ToolPanel
            tool={selected}
            properties={selectedProps}
            required={selectedRequired}
            args={args}
            onArgChange={onArgChange}
            onPreview={onPreview}
            onExecute={onExecute}
            busy={busy}
            result={result}
          />
        ) : (
          <p className="text-sm text-(--text-secondary)">Select a tool to inspect and run it.</p>
        )}
      </div>
    </div>
  )
}

function ToolListCard({
  tool,
  isActive,
  onClick,
}: {
  tool: ToolDescriptor
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      className="text-left rounded-md border p-3 transition-colors"
      style={{
        background: isActive ? 'var(--color-brand-50)' : 'var(--surface-raised)',
        borderColor: isActive ? 'var(--color-brand-500)' : 'var(--border-subtle)',
        color: isActive ? 'var(--color-brand-700)' : 'inherit',
      }}
    >
      <div className="font-semibold text-sm">
        <code className="font-mono">{tool.name}</code>
      </div>
      <p className="text-xs text-(--text-secondary) mt-1">
        {tool.description || 'No description provided.'}
      </p>
    </button>
  )
}

function ToolPanel({
  tool,
  properties,
  required,
  args,
  onArgChange,
  onPreview,
  onExecute,
  busy,
  result,
}: {
  tool: ToolDescriptor
  properties: Record<string, unknown>
  required: Set<string>
  args: Record<string, unknown>
  onArgChange: (key: string, value: unknown, schema: unknown) => void
  onPreview: () => void
  onExecute: () => void
  busy: 'preview' | 'execute' | null
  result: ResultView
}) {
  const propEntries = Object.entries(properties)

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <code className="text-base font-semibold">{tool.name}</code>
        <p className="text-sm opacity-80">{tool.description}</p>
      </header>

      <Surface className="p-3 flex flex-col gap-3">
        {propEntries.length > 0 ? (
          propEntries.map(([key, schema]) => (
            <ArgInput
              key={key}
              name={key}
              schema={schema}
              required={required.has(key)}
              value={args[key]}
              onChange={(v) => onArgChange(key, v, schema)}
            />
          ))
        ) : (
          <p className="text-sm text-(--text-secondary)">This tool has no arguments.</p>
        )}
      </Surface>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onExecute} loading={busy === 'execute'} disabled={busy !== null}>
          Execute
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onPreview}
          loading={busy === 'preview'}
          disabled={busy !== null}
        >
          Preview
        </Button>
      </div>

      {result && <ResultPanel view={result} />}
    </div>
  )
}

function ResultPanel({ view }: { view: NonNullable<ResultView> }) {
  let statusLabel: string
  let statusColor: string
  let durationMs: number | undefined
  let body: unknown

  if (view.kind === 'execute') {
    const r = view.result
    statusLabel = r.type
    statusColor = STATUS_COLOR[r.type] ?? 'var(--text-secondary)'
    durationMs = r.durationMs
    body = r.result
  } else {
    const r = view.result
    if (r.kind === 'not_supported') {
      statusLabel = 'not supported'
      statusColor = 'var(--color-gray-700)'
      durationMs = view.durationMs
      body = { reason: r.reason, toolName: r.toolName }
    } else {
      statusLabel = 'preview'
      statusColor = 'var(--color-blue-700)'
      durationMs = view.durationMs
      body = r.preview
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">Result</h3>
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: statusColor }}
        >
          {statusLabel}
        </span>
        {durationMs !== undefined && <span className="text-xs opacity-70">{durationMs}ms</span>}
      </header>
      <JsonBlock value={body} />
    </div>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  const text = useMemo(() => formatJson(value), [value])
  return (
    <div className="group relative">
      <Surface className="p-3">
        <pre className="font-mono text-xs whitespace-pre-wrap wrap-break-word max-h-96 overflow-auto">
          {text}
        </pre>
      </Surface>
      <CopyButton
        text={text}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
      />
    </div>
  )
}

/**
 * Renders a single typed input for one JSON-Schema property. Mirrors
 * `overseer-local`'s renderArgInput — strings → text input, integer/number →
 * number input, boolean → checkbox, enum → `<select>`, array → comma-separated
 * text input with helper text, object → JSON textarea with helper text. Marks
 * required fields with a red `*`.
 */
function ArgInput({
  name,
  schema,
  required,
  value,
  onChange,
}: {
  name: string
  schema: unknown
  required: boolean
  value: unknown
  onChange: (value: unknown) => void
}) {
  const s = (schema && typeof schema === 'object' ? schema : {}) as Record<string, unknown>
  const type = (s.type as string | undefined) ?? 'string'
  const description = (s.description as string | undefined) ?? name
  const label = (
    <>
      {description} {required && <span style={{ color: 'var(--color-red-700)' }}>*</span>}
    </>
  )

  if (Array.isArray(s.enum)) {
    return (
      <Field label={label}>
        <NativeSelect
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="" disabled>
            Select…
          </option>
          {(s.enum as unknown[]).map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </NativeSelect>
      </Field>
    )
  }

  if (type === 'boolean') {
    return (
      <Field label={label}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="opacity-70">{value === true ? 'true' : 'false'}</span>
        </label>
      </Field>
    )
  }

  if (type === 'array') {
    return (
      <Field label={label} hint="Enter a comma-separated list.">
        <Input
          value={Array.isArray(value) ? (value as unknown[]).join(', ') : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="value1, value2, …"
          spellCheck={false}
        />
      </Field>
    )
  }

  if (type === 'object') {
    return (
      <Field label={label} hint="Provide a valid JSON object.">
        <Textarea
          rows={5}
          value={typeof value === 'string' ? value : value ? JSON.stringify(value, null, 2) : ''}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </Field>
    )
  }

  if (type === 'integer' || type === 'number') {
    return (
      <Field label={label}>
        <Input
          type="number"
          value={typeof value === 'number' ? String(value) : ((value as string) ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    )
  }

  return (
    <Field label={label}>
      <Input
        value={typeof value === 'string' ? value : ((value as string) ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

function coerceValue(schema: unknown, raw: unknown): unknown {
  const s = (schema && typeof schema === 'object' ? schema : {}) as Record<string, unknown>
  const t = s.type as string | undefined
  if (t === 'boolean') return Boolean(raw)
  if (t === 'integer' || t === 'number') {
    if (raw === '' || raw === null || raw === undefined) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  if (t === 'array') {
    if (typeof raw === 'string') {
      const parts = raw
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
      const items = (s.items && typeof s.items === 'object' ? s.items : {}) as Record<
        string,
        unknown
      >
      if (items.type === 'number' || items.type === 'integer') {
        return parts.map((p) => Number(p)).filter((n) => Number.isFinite(n))
      }
      if (items.type === 'boolean') {
        return parts.map((p) => p.toLowerCase() === 'true')
      }
      return parts
    }
    return Array.isArray(raw) ? raw : []
  }
  if (t === 'object') {
    if (typeof raw === 'string') {
      try {
        return raw.length > 0 ? JSON.parse(raw) : {}
      } catch {
        return raw
      }
    }
    return raw
  }
  return raw
}

function getProperties(parameters: unknown): Record<string, unknown> {
  if (!parameters || typeof parameters !== 'object') return {}
  const props = (parameters as { properties?: unknown }).properties
  return props && typeof props === 'object' ? (props as Record<string, unknown>) : {}
}

function getRequired(parameters: unknown): Set<string> {
  if (!parameters || typeof parameters !== 'object') return new Set()
  const r = (parameters as { required?: unknown }).required
  return Array.isArray(r) ? new Set(r.filter((x): x is string => typeof x === 'string')) : new Set()
}

function groupByCategory(
  tools: ToolDescriptor[],
  filter: string,
): Array<{ category: string; items: ToolDescriptor[] }> {
  const term = filter.trim().toLowerCase()
  const matched = term
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          (t.category ?? 'general').toLowerCase().includes(term),
      )
    : tools
  const buckets = new Map<string, ToolDescriptor[]>()
  for (const tool of matched) {
    const cat = tool.category ?? 'general'
    let arr = buckets.get(cat)
    if (!arr) {
      arr = []
      buckets.set(cat, arr)
    }
    arr.push(tool)
  }
  return Array.from(buckets.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PANEL_COLLAPSED_LS_KEY) === '1'
  } catch {
    return false
  }
}
