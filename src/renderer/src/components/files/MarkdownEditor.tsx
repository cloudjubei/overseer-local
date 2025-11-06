import React, { useEffect, useState } from 'react'
import { useUnsavedChanges } from '../../navigation/UnsavedChanges'
import { useFiles } from '../../contexts/FilesContext'
import { FileMeta } from 'thefactory-tools'
import Markdown from '../ui/Markdown'

export type MarkdownEditorProps = {
  file: FileMeta
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ file }) => {
  const { readFile, writeFile } = useFiles()
  const [value, setValue] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [saveSupported, setSaveSupported] = useState<boolean>(false)
  const [dirty, setDirty] = useState<boolean>(false)

  useUnsavedChanges(`markdown:${file.relativePath!}`, () => dirty)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setSaveSupported(false)
    setDirty(false)
    readFile(file.relativePath!).then((txt) => {
      if (!mounted) return
      setValue(txt ?? '')
      setLoading(false)
      setSaveSupported(true)
    })
    return () => {
      mounted = false
    }
  }, [file.relativePath!])

  async function handleSave() {
    try {
      await writeFile(file.relativePath!, value)
    } catch (e) {
      console.error('Save failed', e)
      alert('Failed to save file')
    }
  }

  return (
    <div className="md-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <strong style={{ flex: 1 }}>{file.name}</strong>
        {saveSupported && (
          <button className="btn" disabled={!dirty} onClick={handleSave}>
            Save
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ padding: 16 }}>Loading...</div>
      ) : (
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              padding: 8,
              borderRight: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <textarea
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setDirty(true)
              }}
              style={{
                flex: 1,
                resize: 'none',
                width: '100%',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
              spellCheck={false}
            />
          </div>
          <div style={{ padding: 12, overflow: 'auto' }}>
            <div className="md-preview">
              <Markdown text={value || ''} allowHtml />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MarkdownEditor
