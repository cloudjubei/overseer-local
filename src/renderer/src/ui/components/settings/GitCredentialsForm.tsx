import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  GetGitCredentialResponse,
  GitCredentialCreateInput,
  GitCredentialEditInput,
} from 'thefactory-ui/headless/api'
import { Alert, Button, Field, Input, SecretInput } from 'thefactory-ui/web'
import { IconSave } from 'thefactory-ui/web/icons'

type GitCredentialsFormMode =
  | { kind: 'create'; onSubmit: (input: GitCredentialCreateInput) => Promise<unknown> }
  | {
      kind: 'edit'
      credentials: GetGitCredentialResponse
      onSubmit: (patch: GitCredentialEditInput) => Promise<unknown>
    }

export type GitCredentialsFormProps = {
  mode: GitCredentialsFormMode
  onCancel: () => void
}

export default function GitCredentialsForm({ mode, onCancel }: GitCredentialsFormProps) {
  const initial = mode.kind === 'edit' ? mode.credentials : null
  const [name, setName] = useState(initial?.name ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [token, setToken] = useState(initial?.token ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    name.trim().length > 0 &&
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    token.trim().length > 0

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await mode.onSubmit({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        token: token.trim(),
      })
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}

      <Field label="Name" hint="Label for these credentials, e.g. “GitHub — personal”">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Personal / Work / Org"
          autoFocus
        />
      </Field>
      <Field label="Username">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your-github-username"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoComplete="off"
        />
      </Field>
      <Field label="Personal access token">
        <SecretInput
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_..."
          autoComplete="off"
          spellCheck={false}
          revealConfirmDescription="The token will be visible until you leave this page."
        />
      </Field>

      <div className="flex justify-end pt-2">
        {mode.kind === 'create' ? (
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            Add credentials
          </Button>
        ) : (
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            loading={submitting}
            disabled={!canSubmit}
            title="Save"
            aria-label="Save"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        )}
      </div>
    </form>
  )
}
