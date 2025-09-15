import { useAppSettings } from '../../contexts/AppSettingsContext'

export default function WebSearchSettings() {
  const { appSettings, updateAppSettings } = useAppSettings()

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Web Search API Keys</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="exa-key" className="block text-sm font-medium mb-1">Exa API Key</label>
          <input
            id="exa-key"
            type="password"
            value={appSettings.webSearchApiKeys?.exa ?? ''}
            onChange={(e) => updateAppSettings({ webSearchApiKeys: { ...appSettings.webSearchApiKeys, exa: e.target.value } })}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="exa_..."
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="serpapi-key" className="block text-sm font-medium mb-1">SerpAPI Key</label>
          <input
            id="serpapi-key"
            type="password"
            value={appSettings.webSearchApiKeys?.serpapi ?? ''}
            onChange={(e) => updateAppSettings({ webSearchApiKeys: { ...appSettings.webSearchApiKeys, serpapi: e.target.value } })}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="your_serpapi_key"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="tavily-key" className="block text-sm font-medium mb-1">Tavily API Key</label>
          <input
            id="tavily-key"
            type="password"
            value={appSettings.webSearchApiKeys?.tavily ?? ''}
            onChange={(e) => updateAppSettings({ webSearchApiKeys: { ...appSettings.webSearchApiKeys, tavily: e.target.value } })}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="tvly-..."
            autoComplete="off"
          />
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mt-1">Keys are stored locally in app settings.</p>
      </div>
    </div>
  )
}
