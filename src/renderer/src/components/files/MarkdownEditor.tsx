import React, { useEffect, useState } from 'react'
import { MarkdownEditor as PackageMarkdownEditor } from 'thefactory-ui/web'
import { useUnsavedChanges } from '../../navigation/UnsavedChanges'
import { useFiles } from '../../contexts/FilesContext'
import { FileMeta } from 'thefactory-tools'

export type MarkdownEditorProps = {
  file: FileMeta
}

// Local wrapper around `thefactory-ui`'s `MarkdownEditor` shell. Owns the
// file load / write-back via `FilesContext` and the navigation-guard for
// unsaved changes. The shell handles the two-pane layout, the pane-
// visibility switch, the per-pane labels, and the icon save button.

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
  }, [file.relativePath])

  async function handleSave() {
    try {
      await writeFile(file.relativePath!, value)
      setDirty(false)
    } catch (e) {
      console.error('Save failed', e)
      alert('Failed to save file')
    }
  }

  return (
    <PackageMarkdownEditor
      title={file.name}
      value={value}
      onChange={(next) => {
        setValue(next)
        setDirty(true)
      }}
      onSave={saveSupported ? handleSave : undefined}
      isDirty={dirty}
      loading={loading}
      allowHtml
    />
  )
}

export default MarkdownEditor
