import React from 'react'
import { createRoot } from 'react-dom/client'
import '../..//index.css'
import { PreviewHost } from './previewHost'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Preview root container not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <PreviewHost />
  </React.StrictMode>,
)
