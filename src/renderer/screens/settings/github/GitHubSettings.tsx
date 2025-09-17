import { Button } from '../../../components/ui/Button'
import { IconEdit, IconDelete, IconPlus } from '../../../components/ui/Icons'
import { useNavigator } from '../../../navigation/Navigator'
import { useGitHubCredentials } from '../../../contexts/GitHubCredentialsContext'

export default function GitHubSettings() {
  const { creds, removeCreds } = useGitHubCredentials()
  const { openModal } = useNavigator()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">GitHub Credentials</h2>
        <Button onClick={() => openModal({ type: 'github-credentials-add' })}>
          <IconPlus className="h-[20px] w-[20px]" />
        </Button>
      </div>
      <div className="border rounded-md divide-y">
        {creds.length === 0 && (
          <div className="p-4 text-sm text-gray-600">
            No credentials yet. Click "Add" to create one.
          </div>
        )}
        {creds.map((c) => (
          <div
            key={c.id}
            className="p-3 flex flex-wrap gap-2 md:flex-nowrap md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-sm text-gray-600 truncate">{c.username} • {c.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => openModal({ type: 'github-credentials-edit', id: c.id! })}
                variant="outline"
              >
                <IconEdit className="w-4 h-4" />
              </Button>
              <Button onClick={() => removeCreds(c.id!)} variant="danger">
                <IconDelete className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)] mt-2">
        Tip: Use separate credentials for personal and work accounts.
      </div>
    </div>
  )
}
