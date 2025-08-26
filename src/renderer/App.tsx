import React, { useEffect } from 'react'
import Navigator from './navigation/Navigator'
import ModalHost from './navigation/ModalHost'
import { initTheme } from './hooks/useTheme'

export default function App() {
  // Ensure persisted theme is applied on app boot
  useEffect(() => { initTheme() }, [])

  return (
    <div className="flex min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)]">
      <Navigator />
      <ModalHost />
    </div>
  )
}
