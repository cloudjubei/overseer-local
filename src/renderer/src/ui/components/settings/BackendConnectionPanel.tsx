import { useState } from 'react'
import type { FormEvent } from 'react'
import { useApi } from '@core/contexts/ApiContext'
import { useAuth } from '@core/contexts/AuthContext'
import { Alert, Button, Field, Input, Surface } from 'thefactory-ui/web'
import { IconSave } from 'thefactory-ui/web/icons'
import { maskSecret } from '@ui/utils/mask'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export default function BackendConnectionPanel() {
  const { token, unauthorized, setToken, clearToken } = useAuth()
  const { wsState } = useApi()
  const [next, setNext] = useState('')
  const [saved, setSaved] = useState(false)

  const onReplace = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = next.trim()
    if (trimmed.length === 0) return
    setToken(trimmed)
    setNext('')
    setSaved(true)
  }

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-xl font-semibold">Backend connection</h2>
        <p className="text-sm opacity-70">Where this web app talks to the backend.</p>
      </header>

      <Surface as="dl" className="flex flex-col gap-2 p-4">
        <Row label="API URL">
          <code className="text-xs">{API_BASE_URL}</code>
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

      <Surface as="form" onSubmit={onReplace} className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Replace token</h3>
        <Field label="New token">
          <Input
            type="password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value)
              setSaved(false)
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a new bearer token"
          />
        </Field>
        {saved && (
          <p className="text-xs" style={{ color: 'var(--color-green-700)' }}>
            Token updated.
          </p>
        )}
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearToken()
              setSaved(false)
            }}
            disabled={!token}
          >
            Clear token
          </Button>
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            disabled={next.trim().length === 0}
            title="Save token"
            aria-label="Save token"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        </div>
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
