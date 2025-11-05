import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { dbService } from '../services/dbService'
import { filesService } from '../services/filesService'
import { documentIngestionService } from '../services/documentIngestionService'
import { useProjectContext } from '../contexts/ProjectContext'
import { gitService } from '../services/gitService'

interface LoadingScreenProps {
  onLoaded: () => void
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoaded }) => {
  const { isAppSettingsLoaded, appSettings } = useAppSettings()
  const { projects } = useProjectContext()
  const [statusText, setStatusText] = useState<string>('Loading your settings…')
  const [isDBSetup, setIsDBSetup] = useState(false)
  const [isIngestionComplete, setIsIngestionComplete] = useState(false)
  const [isGitReady, setIsGitReady] = useState(false)
  const doneRef = useRef(false)

  const isReadyToExit = useMemo(() => {
    return isAppSettingsLoaded && isDBSetup && isIngestionComplete && isGitReady
  }, [isAppSettingsLoaded, isDBSetup, isIngestionComplete, isGitReady])

  const startDatabaseAndIngestion = async (connectionString?: string) => {
    // Connect to DB (if connection string provided)
    if (connectionString) {
      setStatusText('Connecting to database…')
      const dbStatus = await dbService.connect(connectionString)
      if (!dbStatus.connected) {
        // proceed without DB
        setIsDBSetup(true)
        setStatusText('Database unavailable. Continuing…')
      } else {
        await filesService.updateAllTools()
        setIsDBSetup(true)
      }
    } else {
      setIsDBSetup(true)
    }

    // Trigger ingestion of all projects and wait for completion
    try {
      setStatusText('Indexing project files…')
      await documentIngestionService.ingestAllProjects()
      setIsIngestionComplete(true)
      setStatusText('Preparing Git monitors…')
    } catch (e) {
      // If ingestion fails, continue boot to not block the app
      console.warn('[LoadingScreen] Ingestion failed:', (e as any)?.message || e)
      setIsIngestionComplete(true)
      setStatusText('Indexing failed. Preparing Git monitors…')
    }

    // Initialize Git tools per project and start monitors with current branch as base
    try {
      const projectIds = projects.map((p) => p.id)
      // For each project, discover current branch via unified list, then start monitor on that base
      await Promise.all(
        projectIds.map(async (pid) => {
          try {
            const unified = await gitService.listUnifiedBranches(pid)
            const current = unified.find((b) => b.current)
            const base = current?.name || 'main'
            await gitService.startMonitor(pid, { baseBranch: base })
          } catch (err) {
            console.warn('[LoadingScreen] Git init failed for project', pid, err)
            // Do not throw; continue initializing others
          }
        }),
      )
      setIsGitReady(true)
      setStatusText('Ready')
    } catch (e) {
      // Should not happen due to per-project guards, but ensure we unblock
      console.warn('[LoadingScreen] Git initialization failed:', (e as any)?.message || e)
      setIsGitReady(true)
      setStatusText('Ready')
    }
  }

  useEffect(() => {
    if (isAppSettingsLoaded) {
      startDatabaseAndIngestion(appSettings.database.connectionString)
    }
  }, [isAppSettingsLoaded])

  useEffect(() => {
    if (isReadyToExit && !doneRef.current) {
      doneRef.current = true
      onLoaded()
    }
  }, [isReadyToExit, doneRef])

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-black/20"
      style={{ fontFamily: 'sans-serif' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-transparent rounded-full" />
        <div className="text-gray-700 dark:text-gray-200 text-sm">{statusText}</div>
      </div>
    </div>
  )
}

export default LoadingScreen
