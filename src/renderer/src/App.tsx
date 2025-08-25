import React, { useEffect, useState } from 'react'

declare global {
  interface Window {
    api: {
      ping: () => Promise<string>
      versions: { node: string; chrome: string; electron: string }
    }
  }
}

export default function App() {
  const [pong, setPong] = useState<string>('...')
  useEffect(() => {
    window.api.ping().then(setPong)
  }, [])

  return (
    <div className="container">
      <h1>Electron + React + TypeScript</h1>
      <p>Secure defaults enabled: contextIsolation=true, sandbox=true.</p>
      <p>IPC roundtrip: {pong}</p>
      <ul>
        <li>Electron: {window.api.versions.electron}</li>
        <li>Chromium: {window.api.versions.chrome}</li>
        <li>Node: {window.api.versions.node}</li>
      </ul>
    </div>
  )
}
