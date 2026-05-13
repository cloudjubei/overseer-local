import { useAppSettings } from '../../../contexts/AppSettingsContext'
import { SecretInput } from 'thefactory-ui/web'

const PROVIDERS = [
  { key: 'exa', label: 'Exa API Key', placeholder: 'exa_...' },
  { key: 'serpapi', label: 'SerpAPI Key', placeholder: 'your_serpapi_key' },
  { key: 'tavily', label: 'Tavily API Key', placeholder: 'tvly-...' },
] as const

export default function WebSearchSettings() {
  const { appSettings, updateAppSettings } = useAppSettings()

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Web Search API Keys</h2>
      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <div key={p.key}>
            <label htmlFor={`websearch-${p.key}`} className="block text-sm font-medium mb-1">
              {p.label}
            </label>
            <SecretInput
              id={`websearch-${p.key}`}
              value={appSettings.webSearchApiKeys?.[p.key] ?? ''}
              onChange={(e) =>
                updateAppSettings({
                  webSearchApiKeys: {
                    ...appSettings.webSearchApiKeys,
                    [p.key]: e.target.value,
                  },
                })
              }
              wrapperClassName="max-w-md"
              placeholder={p.placeholder}
              autoComplete="off"
              spellCheck={false}
              revealConfirmDescription={`The ${p.label} will be visible until you leave this page.`}
            />
          </div>
        ))}
        <p className="text-[12px] text-(--text-secondary) mt-1">
          Keys are stored locally in app settings.
        </p>
      </div>
    </div>
  )
}
