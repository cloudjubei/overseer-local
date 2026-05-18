import { useState } from 'react'
import { Spinner } from 'thefactory-ui/web'
import { useAuth } from '../core/contexts/AuthContext'
import { health } from '../generated/backend'
import { extractErrorMessage } from '../api/errorMessage'

const DEFAULT_URL = 'http://localhost:3000'

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; version: string; uptime: number }
  | { kind: 'error'; message: string }

/**
 * First-run gate. Captures the backend URL + bearer credential, lets the user
 * verify the combination against `/health`, then persists via `authService`
 * (Electron `safeStorage`). Mirror of web's login flow without the OAuth /
 * callback path — desktop is paste-and-store only.
 */
export default function LoginScreen() {
  const { setBoth } = useAuth()
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL)
  const [token, setToken] = useState('')
  const [testState, setTestState] = useState<TestState>({ kind: 'idle' })
  const [saving, setSaving] = useState(false)

  async function handleTest() {
    setTestState({ kind: 'testing' })
    try {
      const trimmedUrl = baseUrl.trim().replace(/\/+$/, '')
      const trimmedToken = token.trim()
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

  async function handleSave() {
    setSaving(true)
    try {
      await setBoth({
        baseUrl: baseUrl.trim().replace(/\/+$/, ''),
        token: token.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const canSave = baseUrl.trim().length > 0

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-black/20 p-6">
      <div className="w-full max-w-md flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-md p-6 shadow">
        <div>
          <h1 className="text-lg font-semibold">Connect to thefactory-backend</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Paste your backend URL and bearer credential. The credential is encrypted at rest via
            your OS keychain.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Backend URL</span>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:3000"
            className="w-full rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bearer credential</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste credential"
            className="w-full rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testState.kind === 'testing' || baseUrl.trim().length === 0}
            className="rounded border border-gray-300 dark:border-zinc-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {testState.kind === 'testing' ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={14} /> Testing…
              </span>
            ) : (
              'Test connection'
            )}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm"
          >
            {saving ? 'Saving…' : 'Save & continue'}
          </button>
        </div>

        {testState.kind === 'ok' && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Connected: version {testState.version}, uptime {Math.round(testState.uptime)}s.
          </p>
        )}
        {testState.kind === 'error' && (
          <p className="text-sm text-red-700 dark:text-red-400">{testState.message}</p>
        )}
      </div>
    </div>
  )
}
