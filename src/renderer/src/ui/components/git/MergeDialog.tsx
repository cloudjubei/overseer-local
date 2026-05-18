import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useGit } from '@core/contexts/GitContext'
import type { GitMergePlan, GitMergeReport, GitMergeResult } from '@generated/backend'
import {
  Alert,
  Button,
  Field,
  GitFileDiffItem,
  Input,
  Modal,
  Spinner,
  Surface,
  pctColorClass,
  type IntraMode,
} from 'thefactory-ui/web'
import MergeConflictResolver from './MergeConflictResolver'

export type MergeDialogProps = {
  isOpen: boolean
  onClose: () => void
  /**
   * Pre-fills the merge with `branch → baseRef` so the rail's "Merge" /
   * "Merge In" buttons open straight into the review + analysis tabs
   * (matches desktop). When omitted, the dialog falls back to a configure
   * step where the user types sources + base.
   */
  baseRef?: string
  branch?: string
}

type Stage =
  | { kind: 'configure' }
  | { kind: 'planning' }
  | {
      kind: 'review'
      plan: GitMergePlan
      report?: GitMergeReport
      sources: string[]
      baseRef: string | undefined
    }
  | {
      kind: 'applying'
      plan: GitMergePlan
      report?: GitMergeReport
      sources: string[]
      baseRef: string | undefined
    }
  | {
      kind: 'done'
      result: GitMergeResult
      sources: string[]
      baseRef: string | undefined
    }
  | {
      kind: 'resolving'
      result: GitMergeResult
      sources: string[]
      baseRef: string | undefined
    }

type Tab = 'changes' | 'compilation' | 'tests' | 'coverage'
const TAB_LABELS: Record<Tab, string> = {
  changes: 'Changes',
  compilation: 'Compilation',
  tests: 'Tests',
  coverage: 'Coverage',
}

export default function MergeDialog({ isOpen, onClose, baseRef, branch }: MergeDialogProps) {
  const { planMerge, buildMergeReport, applyMerge } = useGit()
  const [stage, setStage] = useState<Stage>({ kind: 'configure' })
  const [error, setError] = useState<string | null>(null)

  // Auto-plan when caller passes `baseRef`/`branch` — desktop's flow.
  useEffect(() => {
    if (!isOpen) return
    if (!branch) return
    let cancelled = false
    const run = async () => {
      setError(null)
      setStage({ kind: 'planning' })
      try {
        const plan = await planMerge({ sources: [branch], baseRef, includePatch: true })
        if (cancelled) return
        // Backend computes the three analyses when asked — saves the
        // frontend from doing fragile heuristic mapping itself.
        let report: GitMergeReport | undefined
        try {
          report = await buildMergeReport({
            plan,
            options: {
              includePatch: true,
              includeStructuredDiff: true,
              analyses: ['compilation', 'tests', 'coverage'],
            },
          })
        } catch {
          // Report is best-effort — we still surface the plan even if the
          // analyses pipeline isn't available for this project.
        }
        if (cancelled) return
        setStage({ kind: 'review', plan, report, sources: [branch], baseRef })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to plan merge')
        setStage({ kind: 'configure' })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isOpen, branch, baseRef, planMerge, buildMergeReport])

  // Reset when the modal closes so reopening starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setStage({ kind: 'configure' })
      setError(null)
    }
  }, [isOpen])

  const close = () => onClose()

  const onPlan = async (sources: string[], base: string | undefined) => {
    setError(null)
    setStage({ kind: 'planning' })
    try {
      const plan = await planMerge({ sources, baseRef: base, includePatch: true })
      let report: GitMergeReport | undefined
      try {
        report = await buildMergeReport({
          plan,
          options: {
            includePatch: true,
            includeStructuredDiff: true,
            analyses: ['compilation', 'tests', 'coverage'],
          },
        })
      } catch {
        // best-effort — plan still rendered without analyses
      }
      setStage({ kind: 'review', plan, report, sources, baseRef: base })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to plan merge')
      setStage({ kind: 'configure' })
    }
  }

  const onApply = async () => {
    if (stage.kind !== 'review') return
    const { sources, baseRef: base, plan, report } = stage
    setError(null)
    setStage({ kind: 'applying', plan, report, sources, baseRef: base })
    try {
      const result = await applyMerge({ sources, baseRef: base, autoStash: true })
      setStage({ kind: 'done', result, sources, baseRef: base })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply merge')
      setStage({ kind: 'review', plan, report, sources, baseRef: base })
    }
  }

  if (stage.kind === 'resolving' && stage.result.conflicts) {
    return (
      <MergeConflictResolver
        isOpen={isOpen}
        onClose={close}
        baseRef={stage.baseRef ?? 'HEAD'}
        branch={stage.sources[0] ?? ''}
        conflicts={stage.result.conflicts}
      />
    )
  }

  const title = branch ? `Merge ${branch}${baseRef ? ` → ${baseRef}` : ''}` : 'Merge branches'

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} size="xl">
      <div className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}

        {stage.kind === 'configure' && <ConfigureStep onPlan={onPlan} />}
        {stage.kind === 'planning' && (
          <div className="flex items-center gap-2 text-sm opacity-70 py-4">
            <Spinner /> Planning merge…
          </div>
        )}
        {(stage.kind === 'review' || stage.kind === 'applying') && (
          <ReviewStep
            plan={stage.plan}
            report={stage.report}
            applying={stage.kind === 'applying'}
            onApply={onApply}
            onBack={!branch ? () => setStage({ kind: 'configure' }) : undefined}
          />
        )}
        {stage.kind === 'done' && (
          <DoneStep
            result={stage.result}
            onClose={close}
            onResolve={
              stage.result.conflicts && stage.result.conflicts.length > 0
                ? () =>
                    setStage({
                      kind: 'resolving',
                      result: stage.result,
                      sources: stage.sources,
                      baseRef: stage.baseRef,
                    })
                : undefined
            }
          />
        )}
      </div>
    </Modal>
  )
}

function ConfigureStep({
  onPlan,
}: {
  onPlan: (sources: string[], baseRef: string | undefined) => void
}) {
  const [sources, setSources] = useState('')
  const [baseRef, setBaseRef] = useState('')

  const sourceList = sources
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const canPlan = sourceList.length > 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canPlan) return
    onPlan(sourceList, baseRef.trim() || undefined)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field
        label="Source branches"
        hint="Space- or comma-separated. The merge plan will combine these onto the base."
      >
        <Input autoFocus value={sources} onChange={(e) => setSources(e.target.value)} />
      </Field>
      <Field label="Base branch (optional)" hint="Defaults to the current branch.">
        <Input value={baseRef} onChange={(e) => setBaseRef(e.target.value)} placeholder="HEAD" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={!canPlan}>
          Plan merge
        </Button>
      </div>
    </form>
  )
}

function ReviewStep({
  plan,
  report,
  applying,
  onApply,
  onBack,
}: {
  plan: GitMergePlan
  report?: GitMergeReport
  applying: boolean
  onApply: () => void
  onBack?: () => void
}) {
  const [tab, setTab] = useState<Tab>('changes')
  // Diff render options for the Changes tab — match desktop's defaults.
  const [wrap, setWrap] = useState(false)
  const [ignoreWS, setIgnoreWS] = useState(false)
  const [intra, setIntra] = useState<IntraMode>('none')

  const conflicts = plan.impactOnLocal?.entries.filter((e) => e.risk === 'conflict') ?? []
  const overwrites = plan.impactOnLocal?.entries.filter((e) => e.risk === 'overwrite') ?? []

  return (
    <div className="flex flex-col gap-3">
      {/* Header summary */}
      <header className="flex flex-wrap items-baseline gap-3 text-sm">
        <span className="font-semibold">Plan summary</span>
        <span className="opacity-70">base: {plan.baseRef}</span>
        <span className="opacity-70">sources: {plan.sources.join(', ')}</span>
        <span className="opacity-70">files: {plan.totals.filesChanged}</span>
        <span style={{ color: 'var(--color-green-700)' }}>+{plan.totals.insertions}</span>
        <span style={{ color: 'var(--color-red-700)' }}>−{plan.totals.deletions}</span>
      </header>

      {(conflicts.length > 0 || overwrites.length > 0) && (
        <Alert>
          {conflicts.length > 0 && (
            <div>
              {conflicts.length} potential conflict{conflicts.length === 1 ? '' : 's'}.
            </div>
          )}
          {overwrites.length > 0 && (
            <div>
              {overwrites.length} file{overwrites.length === 1 ? '' : 's'} would be overwritten
              locally.
            </div>
          )}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-(--border-subtle)">
        {(['changes', 'compilation', 'tests', 'coverage'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs ${
              tab === t
                ? 'border-b-2 border-(--color-brand-700) text-(--text-primary)'
                : 'text-(--text-muted) hover:text-(--text-primary)'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="max-h-[50vh] overflow-auto">
        {tab === 'changes' && (
          <ChangesTab
            plan={plan}
            report={report}
            wrap={wrap}
            ignoreWS={ignoreWS}
            intra={intra}
            onWrapChange={setWrap}
            onIgnoreWSChange={setIgnoreWS}
            onIntraChange={setIntra}
          />
        )}
        {tab === 'compilation' && <CompilationTab report={report} />}
        {tab === 'tests' && <TestsTab report={report} />}
        {tab === 'coverage' && <CoverageTab report={report} />}
      </div>

      <div className="flex justify-between gap-2">
        {onBack ? (
          <Button variant="ghost" onClick={onBack} disabled={applying}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onApply} loading={applying} disabled={applying}>
          Apply merge
        </Button>
      </div>
    </div>
  )
}

function ChangesTab({
  plan,
  report,
  wrap,
  ignoreWS,
  intra,
  onWrapChange,
  onIgnoreWSChange,
  onIntraChange,
}: {
  plan: GitMergePlan
  report?: GitMergeReport
  wrap: boolean
  ignoreWS: boolean
  intra: IntraMode
  onWrapChange: (v: boolean) => void
  onIgnoreWSChange: (v: boolean) => void
  onIntraChange: (v: IntraMode) => void
}) {
  // Prefer the structured report's per-file entries (they carry patch bodies);
  // fall back to the plan's `files` so a missing report still renders.
  const files = report?.files ?? plan.files
  return (
    <div className="flex flex-col gap-3">
      <div className="px-2 py-1 text-xs text-(--text-muted) border border-(--border-subtle) rounded-md flex items-center justify-end gap-3 bg-(--surface-muted)">
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={wrap} onChange={(e) => onWrapChange(e.target.checked)} />
          <span>Wrap</span>
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={ignoreWS}
            onChange={(e) => onIgnoreWSChange(e.target.checked)}
          />
          <span>Ignore WS</span>
        </label>
        <label className="inline-flex items-center gap-1">
          <span>Intra</span>
          <select
            className="border border-(--border-subtle) bg-transparent rounded px-1 py-0.5"
            value={intra}
            onChange={(e) => onIntraChange(e.target.value as IntraMode)}
          >
            <option value="none">none</option>
            <option value="word">word</option>
            <option value="char">char</option>
          </select>
        </label>
      </div>
      {files.length === 0 ? (
        <div className="p-3 text-sm text-(--text-muted)">No file changes.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {files.map((f) => (
            <GitFileDiffItem key={f.path} file={f} diffOpts={{ wrap, ignoreWS, intra }} />
          ))}
        </div>
      )}
    </div>
  )
}

function CompilationTab({ report }: { report?: GitMergeReport }) {
  const info = report?.analysis?.compilation
  if (!info) {
    return (
      <div className="p-3 text-xs text-(--text-muted)">
        Compilation impact analysis unavailable for this project.
      </div>
    )
  }
  return (
    <div className="border border-(--border-subtle) rounded-md p-3 space-y-3">
      <div className="text-sm font-medium">Compilation Impact</div>
      <div className="text-xs text-(--text-secondary)">{info.summary}</div>
      <div className="max-h-64 overflow-auto divide-y divide-(--border-subtle)">
        {info.details.map((d, idx) => (
          <div key={idx} className="py-1.5 flex items-center justify-between gap-3">
            <div className="text-xs font-mono truncate">{d.path}</div>
            <div className="text-xs text-(--text-muted) shrink-0">
              <span
                className={
                  d.risk === 'high'
                    ? 'text-red-600 dark:text-red-400'
                    : d.risk === 'medium'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-neutral-500'
                }
              >
                {d.risk.toUpperCase()}
              </span>
              <span className="ml-2">{d.reason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TestsTab({ report }: { report?: GitMergeReport }) {
  const impact = report?.analysis?.tests
  if (!impact) {
    return (
      <div className="p-3 text-xs text-(--text-muted)">
        Tests impact analysis unavailable for this project.
      </div>
    )
  }
  return (
    <div className="border border-(--border-subtle) rounded-md p-3 space-y-2">
      <div className="text-sm font-medium">Tests Impact</div>
      <div className="text-xs text-(--text-secondary)">
        {impact.impacted.length} potential test{impact.impacted.length === 1 ? '' : 's'} may be
        affected out of {impact.totalCatalog}.
      </div>
      {impact.impacted.length === 0 ? (
        <div className="text-xs text-(--text-muted)">No likely impacted tests detected.</div>
      ) : (
        <div className="max-h-64 overflow-auto">
          <ul className="list-disc pl-5 text-xs text-(--text-secondary) space-y-1">
            {impact.impacted.map((t, i) => (
              <li key={i} className="truncate font-mono" title={t}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CoverageTab({ report }: { report?: GitMergeReport }) {
  const cov = report?.analysis?.coverage
  if (!cov) {
    return (
      <div className="p-3 text-xs text-(--text-muted)">
        Diff coverage unavailable — run coverage in the Tests view first.
      </div>
    )
  }
  return (
    <div className="border border-(--border-subtle) rounded-md p-3 space-y-3">
      <div className="text-sm font-medium">Diff Coverage</div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${pctColorClass(cov.pct)}`}>
          {cov.pct.toFixed(1)}% covered
        </span>
        <span className="text-xs text-(--text-muted)">
          {cov.covered}/{cov.totalAdded} changed lines covered
        </span>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead className="text-(--text-muted)">
            <tr>
              <th className="text-left px-2 py-1">File</th>
              <th className="text-right px-2 py-1">Changed</th>
              <th className="text-right px-2 py-1">Covered</th>
              <th className="text-right px-2 py-1">%</th>
            </tr>
          </thead>
          <tbody>
            {cov.perFile.length === 0 ? (
              <tr>
                <td className="px-2 py-2 text-(--text-muted)" colSpan={4}>
                  No added lines detected in patch.
                </td>
              </tr>
            ) : (
              cov.perFile.map((r, idx) => (
                <tr key={idx} className="border-t border-(--border-subtle)">
                  <td className="px-2 py-1 font-mono truncate" title={r.path}>
                    {r.path}
                  </td>
                  <td className="px-2 py-1 text-right">{r.added}</td>
                  <td className="px-2 py-1 text-right">{r.covered}</td>
                  <td className={`px-2 py-1 text-right ${pctColorClass(r.pct)}`}>
                    {r.pct.toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DoneStep({
  result,
  onClose,
  onResolve,
}: {
  result: GitMergeResult
  onClose: () => void
  onResolve?: () => void
}) {
  const ok = result.ok
  const variant = ok ? 'info' : 'error'
  return (
    <div className="flex flex-col gap-3">
      <Alert variant={variant}>
        {ok ? 'Merge applied.' : 'Merge did not complete cleanly.'}
        {result.message && <div className="opacity-80 mt-1">{result.message}</div>}
      </Alert>
      <dl className="text-sm grid grid-cols-[8rem_1fr] gap-y-1">
        {result.mergeCommit && (
          <>
            <dt className="opacity-60">Merge commit</dt>
            <dd>
              <code className="text-xs">{result.mergeCommit.slice(0, 12)}</code>
            </dd>
          </>
        )}
        {result.fastForward !== undefined && (
          <>
            <dt className="opacity-60">Fast-forward</dt>
            <dd>{result.fastForward ? 'yes' : 'no'}</dd>
          </>
        )}
        {result.aborted !== undefined && (
          <>
            <dt className="opacity-60">Aborted</dt>
            <dd>{result.aborted ? 'yes' : 'no'}</dd>
          </>
        )}
        {result.stashed !== undefined && (
          <>
            <dt className="opacity-60">Auto-stashed</dt>
            <dd>{result.stashed ? 'yes' : 'no'}</dd>
          </>
        )}
      </dl>
      {result.conflicts && result.conflicts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Conflicts</h4>
          <Surface as="ul" className="flex flex-col divide-y max-h-48 overflow-auto">
            {result.conflicts.map((c) => (
              <li key={c.path} className="flex items-baseline gap-3 px-3 py-1.5">
                <code className="text-xs flex-1 truncate">{c.path}</code>
                <span className="text-xs opacity-70">{c.type}</span>
              </li>
            ))}
          </Surface>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {onResolve && (
          <Button variant="secondary" onClick={onResolve}>
            Resolve conflicts…
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
