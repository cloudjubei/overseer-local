import React from 'react'
import FileDisplay, { FileMeta } from './FileDisplay'

// Preview component for the preview runtime
export default function Preview() {
  const sample: FileMeta = {
    name: 'Design_Specs.md',
    size: 48293,
    mtime: Date.now() - 86400000,
    type: 'text/markdown',
    path: 'docs/specs/Design_Specs.md',
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: 16, background: 'var(--surface-0, #fafafa)' }}>
      <FileDisplay file={sample} interactive />
      <FileDisplay
        file={{ ...sample, name: 'huge-video.mp4', type: 'video/mp4', size: 5_123_123_444 }}
      />
      <FileDisplay
        file={{ ...sample, name: 'package.json', type: 'application/json', size: 2541 }}
        density="compact"
      />
      <FileDisplay
        file={{ ...sample, name: 'README', type: 'text/plain', size: 112 }}
        trailing={<span className="badge">Pinned</span>}
      />
    </div>
  )
}
