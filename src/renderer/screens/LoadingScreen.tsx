import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { dbService } from '../services/dbService'
import { documentIngestionService } from '../services/documentIngestionService'

interface LoadingScreenProps {
  onLoaded: () => void
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoaded }) => {
  const { isAppSettingsLoaded, appSettings } = useAppSettings()
  const [statusText, setStatusText] = useState<string>('Loading your settings…')
  const [isDBSetup, setIsDBSetup] = useState(false)
  const [isIngestionComplete, setIsIngestionComplete] = useState(false)
  const doneRef = useRef(false)

  const isReadyToExit = useMemo(() => {
    return isAppSettingsLoaded && isDBSetup && isIngestionComplete
  }, [isAppSettingsLoaded, isDBSetup, isIngestionComplete])

  const startDatabaseAndIngestion = async (connectionString?: string) => {
    // Connect to DB (if connection string provided)
    if (connectionString) {
      setStatusText('Connecting to database…')
      const dbStatus = await dbService.connect(connectionString)
      if (!dbStatus.connected) {
        // proceed without DB
        setIsDBSetup(true)
        setStatusText('Database unavailable. Continuing…')
        setIsIngestionComplete(true)
        return
      }
    }

    setIsDBSetup(true)

    // Trigger ingestion of all projects and wait for completion
    try {
      setStatusText('Indexing project files…')
      await documentIngestionService.ingestAllProjects()
      setIsIngestionComplete(true)
      setStatusText('Ready')
    } catch (e) {
      // If ingestion fails, continue boot to not block the app
      console.warn('[LoadingScreen] Ingestion failed:', (e as any)?.message || e)
      setIsIngestionComplete(true)
      setStatusText('Indexing failed. You can continue using the app.')
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
