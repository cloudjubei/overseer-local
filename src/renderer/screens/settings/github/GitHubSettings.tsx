import { useAppSettings } from '../../contexts/AppSettingsContext'

export default function GitHubSettings() {
  const { appSettings, updateAppSettings } = useAppSettings()

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">GitHub Credentials</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="gh-username" className="block text-sm font-medium mb-1">Username</label>
          <input
            id="gh-username"
            type="text"
            value={appSettings.github?.username ?? ''}
            onChange={(e) => updateAppSettings({ github: { ...appSettings.github, username: e.target.value } })}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="your-github-username"
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="gh-email" className="block text-sm font-medium mb-1">E-mail</label>
          <input
            id="gh-email"
            type="text"
            value={appSettings.github?.email ?? ''}
            onChange={(e) => updateAppSettings({ github: { ...appSettings.github, email: e.target.value } })}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="your-github-email"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="gh-token" className="block text-sm font-medium mb-1">Personal Access Token</label>
          <input
            id="gh-token"
            type="password"
            value={appSettings.github?.token ?? ''}
            onChange={(e) => updateAppSettings({ github: { ...appSettings.github, token: e.target.value } })}
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="ghp_..."
            autoComplete="new-password"
          />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">Token is stored locally in app settings.</p>
        </div>
      </div>
    </div>
  )
}
