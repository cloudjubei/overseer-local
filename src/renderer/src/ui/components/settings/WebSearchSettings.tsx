import { useEffect, useMemo, useState } from 'react'
import { useWebSearchKeys } from '@core/contexts/WebSearchKeysContext'
import { Alert, SecretInput } from 'thefactory-ui/web'

// Three fixed providers we surface (same set as `overseer-local`'s
// WebSearchSettings). Other provider names backed by the backend are still
// editable via the API; they just don't appear in this UI.
const PROVIDERS = [
  { key: 'exa', label: 'Exa API Key', placeholder: 'exa_...' },
  { key: 'serpapi', label: 'SerpAPI Key', placeholder: 'your_serpapi_key' },
  { key: 'tavily', label: 'Tavily API Key', placeholder: 'tvly-...' },
] as const

export default function WebSearchSettings() {
  const { isLoaded, loadError, keys, upsertKey, deleteKey } = useWebSearchKeys()

  const byProvider = useMemo(() => {
    const m: Record<string, string> = {}
    for (const k of keys) m[k.provider] = k.apiKey
    return m
  }, [keys])

  // Local drafts so typing doesn't fire one upsert per keystroke. Persist on blur.
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, string> = { ...prev }
      for (const p of PROVIDERS) {
        if (next[p.key] === undefined) next[p.key] = byProvider[p.key] ?? ''
      }
      return next
    })
  }, [byProvider])

  const onBlur = async (provider: string) => {
    const value = (drafts[provider] ?? '').trim()
    const existing = byProvider[provider] ?? ''
    if (value === existing) return
    if (value.length === 0) {
      if (existing.length > 0) await deleteKey(provider)
      return
    }
    await upsertKey({ provider, apiKey: value })
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Web Search API Keys</h2>

      {loadError && <Alert>{loadError.message}</Alert>}

      <div className="space-y-4">
        {!isLoaded ? (
          <p className="text-sm text-(--text-secondary)">Loading…</p>
        ) : (
          PROVIDERS.map((p) => (
            <div key={p.key}>
              <label htmlFor={`websearch-${p.key}`} className="block text-sm font-medium mb-1">
                {p.label}
              </label>
              <SecretInput
                id={`websearch-${p.key}`}
                value={drafts[p.key] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [p.key]: e.target.value })}
                onBlur={() => void onBlur(p.key)}
                wrapperClassName="max-w-md"
                placeholder={p.placeholder}
                autoComplete="off"
                spellCheck={false}
                revealConfirmDescription={`The ${p.label} will be visible until you leave this page.`}
              />
            </div>
          ))
        )}
        <p className="text-[12px] text-(--text-secondary) mt-1">
          Keys are stored encrypted on the backend.
        </p>
      </div>
    </div>
  )
}
