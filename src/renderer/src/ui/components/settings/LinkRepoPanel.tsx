import { useState, type FormEvent } from 'react'
import {
  initializeRepo,
  getResponseDataMessage,
} from 'thefactory-ui/headless/api'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { Alert } from 'thefactory-ui/web'
import { Button } from 'thefactory-ui/web'
import { Field } from 'thefactory-ui/web'
import { Input } from 'thefactory-ui/web'
import { ConfirmDialog } from 'thefactory-ui/web'
import { Surface } from 'thefactory-ui/web'

/**
 * Per-project panel for linking a git repository to a backend-local project
 * (one created without a `repo_url`). Either initialises a fresh empty repo
 * or clones a remote — both via the backend's `initializeRepo` route, which
 * unlocks the `'inProject'` data-location option for this project.
 *
 * Once a repo is linked, the panel collapses to a read-only display of the
 * URL — no "remove" / "swap" action lives here (destructive, out of scope).
 */
export default function LinkRepoPanel() {
  const { projectId, project } = useActiveProject()

  if (!projectId || !project) {
    return (
      <section className="flex flex-col gap-3">
        <Header />
        <p className="text-sm opacity-70">Select a project to manage its repository.</p>
      </section>
    )
  }

  const repoUrl = project.repo_url
  const hasRepo = repoUrl.length > 0

  return (
    <section className="flex flex-col gap-3">
      <Header />
      {hasRepo ? <LinkedRepo url={repoUrl} /> : <UnlinkedActions projectId={projectId} />}
    </section>
  )
}

function Header() {
  return (
    <header>
      <h2 className="text-xl font-semibold">Repository</h2>
      <p className="text-sm opacity-70">
        The git repository this project tracks. Linking one unlocks the “Keep inside this project’s
        git repository” data-location option.
      </p>
    </header>
  )
}

function LinkedRepo({ url }: { url: string }) {
  return (
    <Surface className="flex flex-col gap-3 p-4">
      <Field label="Linked repository URL">
        <Input value={url} readOnly />
      </Field>
    </Surface>
  )
}

function UnlinkedActions({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [busyKind, setBusyKind] = useState<'init' | 'clone' | null>(null)
  const [confirmInit, setConfirmInit] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')

  const initEmpty = async () => {
    setBusyKind('init')
    setError(null)
    try {
      await initializeRepo({
        path: { id: projectId },
        body: { kind: 'init' },
        throwOnError: true,
      })
    } catch (err) {
      setError(
        getResponseDataMessage(err) ??
          (err instanceof Error ? err.message : 'Could not initialise repository.'),
      )
    } finally {
      setBusyKind(null)
    }
  }

  const submitClone = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = cloneUrl.trim()
    if (!trimmed || busyKind) return
    setBusyKind('clone')
    setError(null)
    try {
      await initializeRepo({
        path: { id: projectId },
        body: { kind: 'clone', remoteUrl: trimmed },
        throwOnError: true,
      })
    } catch (err) {
      setError(
        getResponseDataMessage(err) ??
          (err instanceof Error ? err.message : 'Could not clone repository.'),
      )
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <>
      <Surface className="flex flex-col gap-3 p-4">
        <span className="text-sm font-medium">Initialise an empty git repository</span>
        <span className="text-xs opacity-70">
          Creates a fresh git repository in this project’s working directory. You can add a remote
          later from your shell.
        </span>
        <Button
          variant="secondary"
          onClick={() => {
            setError(null)
            setConfirmInit(true)
          }}
          loading={busyKind === 'init'}
          disabled={busyKind !== null && busyKind !== 'init'}
        >
          Initialise empty repository
        </Button>
      </Surface>

      <Surface as="form" onSubmit={submitClone} className="flex flex-col gap-3 p-4">
        <span className="text-sm font-medium">Clone an existing repository</span>
        <span className="text-xs opacity-70">
          The backend clones from this URL into this project’s working directory.
        </span>
        <Field label="Git URL">
          <Input
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="git@github.com:org/repo.git"
          />
        </Field>
        <Button
          type="submit"
          loading={busyKind === 'clone'}
          disabled={!cloneUrl.trim() || (busyKind !== null && busyKind !== 'clone')}
        >
          Clone repository
        </Button>
      </Surface>

      {error && <Alert variant="error">{error}</Alert>}

      <ConfirmDialog
        isOpen={confirmInit}
        onClose={() => setConfirmInit(false)}
        onConfirm={initEmpty}
        title="Initialise an empty git repository?"
        description="A fresh git repository will be created in this project’s working directory. You can add a remote later from your shell."
        confirmLabel="Initialise"
        cancelLabel="Cancel"
      />
    </>
  )
}
