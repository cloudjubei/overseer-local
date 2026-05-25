import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '@core/contexts/ApiContext'
import { useAuth } from '@core/contexts/AuthContext'
import { maskSecret } from 'thefactory-ui/headless'
import {
  health,
  extractErrorMessage,
} from 'thefactory-ui/headless/api'
import { Alert, Button, Field, Input, Spinner, Surface } from 'thefactory-ui/web'
import { IconSave } from 'thefactory-ui/web/icons'

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; version: string; uptime: number }
  | { kind: 'error'; message: string }

/**
 * Desktop's adaptation of web's [`BackendConnectionPanel`](../../../../../../thefactory-overseer-web/src/ui/components/settings/BackendConnectionPanel.tsx).
 * The visual shell + token-replace flow are identical; the URL panel and
 * Reset-all controls are desktop-only because the base URL is part of the
 * `safeStorage`-backed `AuthContext` here (web's URL is build-time-fixed via
 * `VITE_API_BASE_URL`).
 *
 * The long-term home for this surface is `thefactory-ui/headless` with a
 * `TokenStorage` adapter — see [thefactory-ui/docs/implementation-plan.md § B.5](../../../../../../thefactory-ui/docs/implementation-plan.md).
 */
export default function BackendConnectionPanel() {
  const { baseUrl, token, unauthorized, setToken, clearToken, setBaseUrl, clear } = useAuth()
  const { wsState } = useApi()
  const [nextToken, setNextToken] = useState('')
  const [tokenSaved, setTokenSaved] = useState(false)
  const [nextUrl, setNextUrl] = useState('')
  const [urlSaved, setUrlSaved] = useState(false)
  const [testState, setTestState] = useState<TestState>({ kind: 'idle' })

  const onReplaceToken = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = nextToken.trim()
    if (trimmed.length === 0) return
    void setToken(trimmed)
    setNextToken('')
    setTokenSaved(true)
  }

  const onReplaceUrl = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = nextUrl.trim().replace(/\/+$/, '')
    if (trimmed.length === 0) return
    void setBaseUrl(trimmed)
    setNextUrl('')
    setUrlSaved(true)
    setTestState({ kind: 'idle' })
  }

  const onTestUrl = async () => {
    const candidate = nextUrl.trim().replace(/\/+$/, '') || (baseUrl ?? '')
    if (candidate.length === 0) return
    setTestState({ kind: 'testing' })
    try {
      const res = await health({
        throwOnError: true,
        baseURL: candidate,
        auth: () => token ?? undefined,
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

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-xl font-semibold">Backend connection</h2>
        <p className="text-sm opacity-70">Where this desktop client talks to the backend.</p>
      </header>

      <Surface as="dl" className="flex flex-col gap-2 p-4">
        <Row label="API URL">
          {baseUrl ? (
            <code className="text-xs">{baseUrl}</code>
          ) : (
            <span className="text-sm opacity-70">Not set</span>
          )}
        </Row>
        <Row label="WebSocket">
          <StatusDot state={wsState} />
          <span className="text-sm">{wsState}</span>
        </Row>
        <Row label="Bearer token">
          {token ? (
            <code className="text-xs opacity-70">{maskSecret(token)}</code>
          ) : (
            <span className="text-sm opacity-70">Not set</span>
          )}
        </Row>
      </Surface>

      {unauthorized && (
        <Alert>The current token was rejected by the backend. Update it below.</Alert>
      )}

      <Surface as="form" onSubmit={onReplaceUrl} className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Replace URL</h3>
        <Field label="New URL">
          <Input
            type="url"
            value={nextUrl}
            onChange={(e) => {
              setNextUrl(e.target.value)
              setUrlSaved(false)
              setTestState({ kind: 'idle' })
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="http://localhost:7001"
          />
        </Field>
        {urlSaved && (
          <p className="text-xs" style={{ color: 'var(--color-green-700)' }}>
            URL updated.
          </p>
        )}
        {testState.kind === 'ok' && (
          <p className="text-xs" style={{ color: 'var(--color-green-700)' }}>
            Reachable: version {testState.version}, uptime {Math.round(testState.uptime)}s.
          </p>
        )}
        {testState.kind === 'error' && (
          <p className="text-xs" style={{ color: 'var(--color-red-700)' }}>
            {testState.message}
          </p>
        )}
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onTestUrl()}
            disabled={
              testState.kind === 'testing' ||
              (nextUrl.trim().length === 0 && (baseUrl ?? '').length === 0)
            }
          >
            {testState.kind === 'testing' ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={14} /> Testing…
              </span>
            ) : (
              'Test connection'
            )}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            disabled={nextUrl.trim().length === 0}
            title="Save URL"
            aria-label="Save URL"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        </div>
      </Surface>

      <Surface as="form" onSubmit={onReplaceToken} className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Replace token</h3>
        <Field label="New token">
          <Input
            type="password"
            value={nextToken}
            onChange={(e) => {
              setNextToken(e.target.value)
              setTokenSaved(false)
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a new bearer token"
          />
        </Field>
        {tokenSaved && (
          <p className="text-xs" style={{ color: 'var(--color-green-700)' }}>
            Token updated.
          </p>
        )}
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void clearToken()
              setTokenSaved(false)
            }}
            disabled={!token}
          >
            Clear token
          </Button>
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            disabled={nextToken.trim().length === 0}
            title="Save token"
            aria-label="Save token"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        </div>
      </Surface>

      <Surface className="flex items-center justify-between gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">Reset connection</h3>
          <p className="text-xs opacity-70">Clears both URL and token; returns you to the login screen.</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => void clear()} disabled={!baseUrl && !token}>
          Reset all
        </Button>
      </Surface>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="text-xs uppercase tracking-wide opacity-60 w-28 shrink-0">{label}</dt>
      <dd className="flex items-center gap-2 min-w-0">{children}</dd>
    </div>
  )
}

function StatusDot({ state }: { state: string }) {
  const color =
    state === 'open'
      ? 'var(--color-green-600)'
      : state === 'connecting'
        ? 'var(--color-orange-500)'
        : 'var(--color-gray-400)'
  return (
    <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
  )
}
