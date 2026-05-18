import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOverseer } from '@core/contexts/OverseerContext'
import { Alert, Button, ConfirmDialog, Field, Input, Surface } from 'thefactory-ui/web'
import { IconSave } from 'thefactory-ui/web/icons'

export default function OverseerPanel() {
  const { isLoaded, loadError, state, setRemote, removeRemote, push, reset } = useOverseer()

  if (!isLoaded) {
    return (
      <section className="flex flex-col gap-3">
        <PanelHeader />
        <p className="text-sm opacity-70">Loading…</p>
      </section>
    )
  }

  if (loadError || !state) {
    return (
      <section className="flex flex-col gap-3">
        <PanelHeader />
        <Alert variant="error">
          {loadError?.message ?? 'Could not load thefactory-overseer state.'}
        </Alert>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <PanelHeader />

      <Surface className="flex flex-col gap-3 p-4">
        <Field
          label="On-disk path"
          hint="Where this machine stores the thefactory-overseer project."
        >
          <Input value={state.path} readOnly />
        </Field>
      </Surface>

      <RemoteSection
        hasRemote={state.hasRemote}
        remoteUrl={state.remoteUrl}
        setRemote={setRemote}
        removeRemote={removeRemote}
        push={push}
      />

      <Surface className="flex flex-col gap-1 p-4">
        <span className="text-sm font-medium">Projects in this overseer</span>
        <span className="text-sm opacity-70">{state.projectCount}</span>
      </Surface>

      <SwitchOverseerSection hasRemote={state.hasRemote} reset={reset} />
    </section>
  )
}

function PanelHeader() {
  return (
    <header>
      <h2 className="text-xl font-semibold">thefactory-overseer</h2>
      <p className="text-sm opacity-70">
        The central git repo that owns your projects’ registry, credentials, and (for projects on
        the central data-location) their stories and chats.
      </p>
    </header>
  )
}

function RemoteSection({
  hasRemote,
  remoteUrl,
  setRemote,
  removeRemote,
  push,
}: {
  hasRemote: boolean
  remoteUrl: string | undefined
  setRemote: (url: string) => Promise<void>
  removeRemote: () => Promise<void>
  push: () => Promise<{ pushedBranches: string[] }>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  if (hasRemote && !editing) {
    return (
      <Surface className="flex flex-col gap-3 p-4">
        <Field label="Remote URL" hint="Daily squashes push to this remote.">
          <Input value={remoteUrl ?? ''} readOnly />
        </Field>
        {removeError && <Alert variant="error">{removeError}</Alert>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Change…
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setRemoveError(null)
              setConfirmRemove(true)
            }}
          >
            Remove
          </Button>
        </div>
        <ConfirmDialog
          isOpen={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          onConfirm={async () => {
            try {
              await removeRemote()
            } catch (err) {
              setRemoveError(err instanceof Error ? err.message : 'Could not remove remote URL.')
            }
          }}
          title="Stop syncing this overseer?"
          description="The remote URL is unset. Local data and history aren’t touched — daily squashes will only commit locally until you set a new remote."
          confirmLabel="Remove remote"
          cancelLabel="Cancel"
          destructive
        />
      </Surface>
    )
  }

  return (
    <RemoteForm
      initialUrl={editing ? (remoteUrl ?? '') : ''}
      submitLabel={editing ? 'Save' : 'Add remote'}
      onCancel={editing ? () => setEditing(false) : undefined}
      onSubmit={async (url) => {
        // Save the URL first; if that fails the remote isn't attached at all
        // and we surface the raw error. If save succeeds, push immediately so
        // the user doesn't have to wait for the next daily squash. Push
        // failures get a composed message that makes it clear the URL did
        // save — only the first push didn't go through.
        await setRemote(url)
        try {
          await push()
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'push failed'
          throw new Error(
            `Remote saved, but the first push didn’t go through: ${detail}. The next daily squash will retry.`,
          )
        }
        setEditing(false)
      }}
    />
  )
}

function SwitchOverseerSection({
  hasRemote,
  reset,
}: {
  hasRemote: boolean
  reset: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Surface className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Switch to a different overseer</span>
        <span className="text-xs opacity-70">
          Archives the current overseer to the host’s archive directory (recoverable) and returns
          you to the welcome flow. The remote, if any, is left untouched.
        </span>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        variant="danger"
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
      >
        Switch overseer…
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await reset()
            // Leave the project-scoped settings route — without this we
            // sit on `/projects/<archived>/settings`, but AuthedRoot owns
            // the post-reset welcome routing.
            navigate('/', { replace: true })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not archive the current overseer.')
          }
        }}
        title="Switch to a different overseer?"
        description={
          hasRemote
            ? 'The current overseer is archived locally (recoverable from the host’s archive directory). The remote is left untouched, so you can re-clone it later if you change your mind.'
            : 'The current overseer is archived locally (recoverable from the host’s archive directory). It has no remote, so once archived it only exists in the archive directory — back it up first if you need it.'
        }
        confirmLabel="Archive and switch"
        cancelLabel="Cancel"
        destructive
      />
    </Surface>
  )
}

function RemoteForm({
  initialUrl,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initialUrl: string
  submitLabel: string
  onCancel?: () => void
  onSubmit: (url: string) => Promise<void>
}) {
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save remote URL.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Surface className="flex flex-col gap-3 p-4" as="form" onSubmit={submit}>
      <Field
        label="Remote URL"
        hint="HTTPS or SSH — auth is handled by the host’s git credential helper / SSH agent."
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="git@github.com:org/overseer.git"
          autoFocus
        />
      </Field>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex gap-2">
        {submitLabel === 'Save' ? (
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            loading={busy}
            disabled={!url.trim()}
            title="Save"
            aria-label="Save"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        ) : (
          <Button type="submit" loading={busy} disabled={!url.trim()}>
            {submitLabel}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </Surface>
  )
}
