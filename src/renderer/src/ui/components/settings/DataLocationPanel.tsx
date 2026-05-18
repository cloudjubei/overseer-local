import { useState } from 'react'
import { Alert } from 'thefactory-ui/web'
import { ConfirmDialog } from 'thefactory-ui/web'
import { Surface } from 'thefactory-ui/web'

/**
 * Documented schema for the per-project data-location switch. Mirrors
 * `ProjectDataLocation` from `thefactory-tools` (block A in
 * docs/implementation-plan.md). Parents pass `project.dataLocation ?? 'central'`
 * here directly — this string-literal union does not need an `@api/types` alias.
 */
export type DataLocation = 'central' | 'inProject'

type OptionDef = {
  value: DataLocation
  title: string
  hint: string
}

const OPTIONS: ReadonlyArray<OptionDef> = [
  {
    value: 'central',
    title: 'Keep with thefactory-overseer project (recommended)',
    hint: 'Stories and chats live alongside other metadata in your thefactory-overseer project.',
  },
  {
    value: 'inProject',
    title: 'Keep inside this project’s git repository',
    hint: 'Stories and chats are committed to this project’s repository and travel with its git history.',
  },
]

const IN_PROJECT_DISABLED_HINT =
  'Link a git repository for this project first — see the “Repository” section.'

export type DataLocationPanelProps = {
  /** Current location, taken from `ProjectSpec.dataLocation` (treat absence as `'central'`). */
  value: DataLocation
  /**
   * Whether this project has a linked git repository (i.e. `repo_url` is
   * non-empty). The `'inProject'` option requires one — the radio is disabled
   * with an explanatory tooltip until the project is linked. See A'2 in
   * docs/implementation-plan.md.
   */
  hasRepo: boolean
  /**
   * Persist a new location. Should call `setProjectDataLocation` with
   * `{ throwOnError: true }` and rely on the `projects:updated` WS broadcast
   * to drive re-fetch — do NOT optimistic-update.
   */
  onChange: (next: DataLocation) => Promise<void>
}

export default function DataLocationPanel({ value, hasRepo, onChange }: DataLocationPanelProps) {
  const [pending, setPending] = useState<DataLocation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startChange = (next: DataLocation) => {
    if (next === value) return
    if (next === 'inProject' && !hasRepo) return
    setError(null)
    setPending(next)
  }

  const cancel = () => {
    setPending(null)
  }

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await onChange(pending)
      setPending(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change data location.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-xl font-semibold">Data location</h2>
        <p className="text-sm opacity-70">
          Where this project’s stories and chats are kept. Switchable any time — existing data is
          moved between the overseer and this project’s repository, never destroyed.
        </p>
      </header>

      <Surface className="flex flex-col gap-2 p-4">
        <fieldset className="flex flex-col gap-2" aria-label="Data location" disabled={busy}>
          {OPTIONS.map((opt) => {
            const isInProjectLocked = opt.value === 'inProject' && !hasRepo
            const checked = value === opt.value
            return (
              <label
                key={opt.value}
                title={isInProjectLocked ? IN_PROJECT_DISABLED_HINT : undefined}
                className="flex items-start gap-3 rounded p-2 hover:bg-(--surface-hover)"
                style={{
                  cursor: isInProjectLocked ? 'not-allowed' : 'pointer',
                  opacity: isInProjectLocked ? 0.5 : 1,
                }}
              >
                <input
                  type="radio"
                  name="data-location"
                  value={opt.value}
                  checked={checked}
                  disabled={isInProjectLocked}
                  onChange={() => startChange(opt.value)}
                  className="mt-1"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{opt.title}</span>
                  <span className="text-xs opacity-70">
                    {isInProjectLocked ? IN_PROJECT_DISABLED_HINT : opt.hint}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {error && <Alert variant="error">{error}</Alert>}
      </Surface>

      <ConfirmDialog
        isOpen={pending !== null}
        onClose={cancel}
        onConfirm={confirm}
        title="Move project data?"
        description={
          pending === 'inProject'
            ? 'Stories and chats will move into this project’s git repository so they travel with its history. Existing data is preserved.'
            : 'Stories and chats will move back into your thefactory-overseer project. Existing data is preserved.'
        }
        confirmLabel={busy ? 'Moving…' : 'Move'}
        cancelLabel="Cancel"
      />
    </section>
  )
}
