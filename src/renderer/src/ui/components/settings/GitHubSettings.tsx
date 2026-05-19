import { useState } from 'react'
import { useGitCredentials } from '@core/contexts/GitCredentialsContext'
import type { GetGitCredentialResponse } from 'thefactory-ui/headless/api'
import { Alert, Button, ConfirmDialog, Modal } from 'thefactory-ui/web'
import { IconDelete, IconEdit, IconPlus } from 'thefactory-ui/web/icons'
import GitCredentialsForm from './GitCredentialsForm'

type ModalRoute =
  | { kind: 'create' }
  | { kind: 'edit'; credentials: GetGitCredentialResponse }
  | { kind: 'delete'; credentials: GetGitCredentialResponse }

export default function GitHubSettings() {
  const {
    isLoaded,
    loadError,
    credentials,
    createCredentials,
    updateCredentials,
    deleteCredentials,
  } = useGitCredentials()
  const [modal, setModal] = useState<ModalRoute | null>(null)

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">GitHub Credentials</h2>
        <Button
          onClick={() => setModal({ kind: 'create' })}
          title="Add credentials"
          aria-label="Add credentials"
        >
          <IconPlus className="h-5 w-5" />
        </Button>
      </div>

      {loadError && <Alert>{loadError.message}</Alert>}

      <div className="border rounded-md divide-y border-(--border-subtle) divide-(--border-subtle)">
        {!isLoaded ? (
          <div className="p-4 text-sm text-(--text-secondary)">Loading…</div>
        ) : credentials.length === 0 ? (
          <div className="p-4 text-sm text-(--text-secondary)">
            No credentials yet. Click the + button to create one.
          </div>
        ) : (
          credentials.map((c) => (
            <div
              key={c.id}
              className="p-3 flex flex-wrap gap-2 md:flex-nowrap md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-sm text-(--text-secondary) truncate">
                  {c.username} • {c.email}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => setModal({ kind: 'edit', credentials: c })}
                  variant="outline"
                  size="icon"
                  title="Edit"
                  aria-label="Edit"
                >
                  <IconEdit className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setModal({ kind: 'delete', credentials: c })}
                  variant="danger"
                  size="icon"
                  title="Delete"
                  aria-label="Delete"
                >
                  <IconDelete className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-[12px] text-(--text-secondary) mt-2">
        Tip: Use separate credentials for personal and work accounts.
      </div>

      {modal?.kind === 'create' && (
        <Modal isOpen onClose={() => setModal(null)} title="New Git credentials">
          <GitCredentialsForm
            mode={{ kind: 'create', onSubmit: createCredentials }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.kind === 'edit' && (
        <Modal isOpen onClose={() => setModal(null)} title={`Edit: ${modal.credentials.name}`}>
          <GitCredentialsForm
            mode={{
              kind: 'edit',
              credentials: modal.credentials,
              onSubmit: (patch) => updateCredentials(modal.credentials.id, patch),
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          isOpen
          onClose={() => setModal(null)}
          title="Delete Git credentials"
          description={`This removes "${modal.credentials.name}" from the backend. Existing git operations may fail without another credential set.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => deleteCredentials(modal.credentials.id)}
        />
      )}
    </div>
  )
}
