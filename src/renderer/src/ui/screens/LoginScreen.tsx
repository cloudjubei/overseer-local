import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@core/contexts/AuthContext'
import { Alert, Button, Input, Spinner } from 'thefactory-ui/web'
import { extractErrorMessage, health } from 'thefactory-ui/headless/api'

const DEFAULT_URL = 'http://localhost:7001'

/**
 * First-run gate. Desktop's twin of [web's same-named screen](../../../../../../thefactory-overseer-web/src/ui/screens/LoginScreen.tsx) —
 * captures the backend URL + bearer credential, lets the user verify the
 * combination against `/health`, then persists both via `setBoth`
 * (`authService`, Electron `safeStorage`). No OAuth / callback path — desktop
 * is paste-and-store only.
 */

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; version: string; uptime: number }
  | { kind: 'error'; message: string }

export default function LoginScreen() {
  const { baseUrl, token, setBoth, unauthorized } = useAuth()
  const navigate = useNavigate()
  const [urlValue, setUrlValue] = useState(baseUrl ?? DEFAULT_URL)
  const [tokenValue, setTokenValue] = useState(token ?? '')
  const [testState, setTestState] = useState<TestState>({ kind: 'idle' })
  const [saving, setSaving] = useState(false)
  const trimmedUrl = urlValue.trim().replace(/\/+$/, '')
  const trimmedToken = tokenValue.trim()
  const canSave = trimmedUrl.length > 0

  async function onTest() {
    if (!canSave) return
    setTestState({ kind: 'testing' })
    try {
      const res = await health({
        throwOnError: true,
        baseURL: trimmedUrl,
        auth: () => trimmedToken || undefined,
      })
      setTestState({
        kind: 'ok',
        version: String(res.data?.version ?? 'unknown'),
        uptime: Number(res.data?.uptime ?? 0),
      })
    } catch (err) {
      setTestState({
        kind: 'error',
        message: extractErrorMessage(err, 'Could not reach the backend.'),
      })
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    try {
      await setBoth({ baseUrl: trimmedUrl, token: trimmedToken.length > 0 ? trimmedToken : null })
      navigate('/', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full w-full p-6">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-md flex flex-col gap-4 p-6 rounded-lg border"
        style={{ background: 'var(--surface-base)', borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h1 className="text-xl font-semibold">Connect to thefactory-backend</h1>
          <p className="text-sm opacity-70 mt-1">
            Enter the backend URL and your bearer credential. The credential is encrypted at rest
            via your OS keychain.
          </p>
        </div>

        {unauthorized && (
          <Alert>The saved token was rejected by the backend. Enter a new one.</Alert>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Backend URL</span>
          <Input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="http://localhost:7001"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Bearer credential</span>
          <Input
            type="password"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onTest}
            disabled={!canSave || testState.kind === 'testing'}
          >
            {testState.kind === 'testing' ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={14} /> Testing…
              </span>
            ) : (
              'Test connection'
            )}
          </Button>
          <Button type="submit" disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save & continue'}
          </Button>
        </div>

        {testState.kind === 'ok' && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Connected: version {testState.version}, uptime {Math.round(testState.uptime)}s.
          </p>
        )}
        {testState.kind === 'error' && (
          <p className="text-sm text-red-700 dark:text-red-400">{testState.message}</p>
        )}
      </form>
    </div>
  )
}
