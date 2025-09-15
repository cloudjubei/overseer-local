import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { dbService } from '../../services/dbService'
import { documentIngestionService } from '../../services/documentIngestionService'

export default function DatabaseSettings() {
  const { appSettings, updateAppSettings } = useAppSettings()

  const [isConnecting, setIsConnecting] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [dbMsg, setDbMsg] = useState<string | null>(null)

  const currentConn = appSettings.database?.connectionString?.trim() || ''

  const onConnectAndIngest = async () => {
    if (!currentConn) return
    setDbMsg(null)
    setIsConnecting(true)
    try {
      const dbStatus = await dbService.connect(currentConn)
      if (!dbStatus?.connected) {
        setDbMsg('Failed to connect. Check your connection string and try again.')
        return
      }
      setDbMsg('Connected. Starting ingestion…')
      setIsIngesting(true)
      await documentIngestionService.ingestAllProjects()
      setDbMsg('Ingestion complete.')
    } catch (e: any) {
      setDbMsg(String(e?.message || e))
    } finally {
      setIsConnecting(false)
      setIsIngesting(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Database</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="db-conn" className="block text-sm font-medium mb-1">thefactory-db Postgres connection string</label>
          <input
            id="db-conn"
            type="text"
            value={currentConn}
            onChange={(e) => updateAppSettings({ database: { ...appSettings.database, connectionString: e.target.value } })}
            className="w-full max-w-xl p-2 border border-gray-300 rounded-md"
            placeholder="postgres://user:pass@host:5432/dbname"
            autoComplete="off"
          />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">Stored locally. Leave empty to use default environment configuration.</p>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={onConnectAndIngest} disabled={!currentConn || isConnecting || isIngesting}>
              {isConnecting ? 'Connecting…' : isIngesting ? 'Ingesting…' : 'Connect & Ingest Now'}
            </Button>
            {dbMsg && <span className="text-sm text-gray-600 dark:text-gray-300">{dbMsg}</span>}
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mt-2">If you change the connection string later, run ingestion again to repopulate the database.</p>
        </div>
      </div>
    </div>
  )
}
