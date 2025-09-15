import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { dbService } from '../services/dbService'

interface LoadingScreenProps {
  onLoaded: () => void
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoaded }) => {
  const { isAppSettingsLoaded, appSettings } = useAppSettings()
  const [statusText, setStatusText] = useState<string>('Loading your settings…')
  const [isDBSetup, setIsDBSetup] = useState(false)
  const doneRef = useRef(false)

  const isReadyToExit = useMemo(() => {
    return isAppSettingsLoaded && isDBSetup
  }, [isAppSettingsLoaded, isDBSetup])

  const startDatabase = async (connectionString?: string) => {
    if (!connectionString) {
      //no user provided connection string - proceed anyway
      setIsDBSetup(true)
      return
    }
    const dbStatus = await dbService.connect(connectionString)
    if (!dbStatus.connected) {
      //bad connection - proceed anyway
      setIsDBSetup(true)
      return
    }

    setIsDBSetup(true)
    //TODO: ingestion of all docs
  }
  useEffect(() => {
    if (isAppSettingsLoaded) {
      startDatabase(appSettings.database.connectionString)
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
