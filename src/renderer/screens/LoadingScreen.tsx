import React, { useEffect, useRef, useState } from 'react'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { dbService, type IngestionProgress } from '../services/dbService'

interface LoadingScreenProps {
  onLoaded: () => void
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoaded }) => {
  const { isAppSettingsLoaded } = useAppSettings()
  const [statusText, setStatusText] = useState<string>('Loading your settings…')
  const doneRef = useRef(false)

  useEffect(() => {
    if (!isAppSettingsLoaded || doneRef.current) return

    let unsubscribe: (() => void) | undefined
    let readyToExit = false

    const maybeFinish = () => {
      if (readyToExit && !doneRef.current) {
        doneRef.current = true
        onLoaded()
      }
    }

    const start = async () => {
      // Listen for ingestion progress
      unsubscribe = dbService.onIngestionStatus((p: IngestionProgress) => {
        if (p.status === 'running') {
          setStatusText(p.message || 'Indexing project files…')
        } else if (p.status === 'done') {
          setStatusText('Indexing complete')
          readyToExit = true
          maybeFinish()
        } else if (p.status === 'error') {
          setStatusText('Indexing failed, continuing…')
          readyToExit = true
          maybeFinish()
        }
      })

      // Trigger ingestion sync after managers/settings are ready
      await dbService.startIngestion()
    }

    setStatusText('Loading your settings…')
    start()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [isAppSettingsLoaded, onLoaded])

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
