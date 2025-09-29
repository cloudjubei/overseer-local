import React, { useEffect, useState } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import { isLikelyText, guessLanguageFromExt } from 'thefactory-tools/utils'
import { FileMeta } from 'thefactory-tools'

export type BasicFileViewerProps = {
  file: FileMeta
}

const BasicFileViewer: React.FC<BasicFileViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const { readFile } = useFiles()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setContent(null)
    if (isLikelyText(file.absolutePath, file.ext, file.type)) {
      readFile(file.relativePath!).then((txt) => {
        if (!mounted) return
        if (txt) {
          setContent(txt)
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
    return () => {
      mounted = false
    }
  }, [file.relativePath!, file.size, file.type])

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>

  const info = (
    <div style={{ padding: 12, color: 'var(--text-muted)' }}>
      <div>
        <strong>{file.name}</strong>
      </div>
      <div>Type: {file.type || (file.ext ? '.' + file.ext : 'unknown')}</div>
      <div>Size: {formatBytes(file.size)}</div>
      <div>Modified: {file.mtime ? new Date(file.mtime).toLocaleString() : 'unknown'}</div>
      {!content && (
        <div style={{ marginTop: 8 }}>
          No viewer available. Content display may be unsupported for this file type.
        </div>
      )}
    </div>
  )

  if (content != null) {
    const lang = guessLanguageFromExt(file.ext)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <strong>{file.name}</strong>{' '}
          {lang ? <span style={{ color: 'var(--text-muted)' }}>({lang})</span> : null}
        </div>
        <pre
          style={{
            margin: 0,
            padding: 12,
            overflow: 'auto',
            whiteSpace: 'pre',
            flex: 1,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {content}
        </pre>
      </div>
    )
  }

  return info
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default BasicFileViewer
