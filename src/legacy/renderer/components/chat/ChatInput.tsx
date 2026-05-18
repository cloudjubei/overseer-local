import { useCallback, useMemo } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import { useStories } from '../../contexts/StoriesContext'
import { ChatInput as ChatInputBase } from 'thefactory-ui/web'

type SendReason = 'user' | 'suggested_action'

export interface ChatInputProps {
  value: string
  attachments: string[]
  onChange: (val: string) => void
  onChangeAttachments: (next: string[]) => void

  selectionStart?: number
  selectionEnd?: number
  onSelectionChange?: (next: { selectionStart?: number; selectionEnd?: number }) => void

  onSend: (message: string, attachments: string[], meta?: { reason?: SendReason }) => void
  onAbort: () => void
  isThinking: boolean
  isConfigured: boolean

  suggestedActions?: string[]
  autoFocus?: boolean
  restoreKey?: string

  clearOnSend?: boolean
  clearOnSuggestedAction?: boolean
}

/**
 * Desktop wrapper around the shared `ChatInput` in `thefactory-ui`.
 * Wires `useFiles().uploadFile` for file attachments + `useFiles().files`
 * for the `@` mention autocomplete + `useStories()` for the `#` reference
 * autocomplete.
 *
 * Mirrors the prop surface of the previous local implementation 1:1 so
 * `ChatSidebar` continues to call it unchanged.
 */
export default function ChatInput(props: ChatInputProps) {
  const { uploadFile, files } = useFiles()
  const { storiesById, featuresById, getStoryDisplayIndex, getFeatureDisplayIndex } = useStories()

  const filePaths = useMemo(
    () => files.map((f) => f.relativePath).filter((p): p is string => typeof p === 'string'),
    [files],
  )

  const onUploadAttachment = useCallback(
    async (file: File): Promise<string | undefined> => {
      const reader = new FileReader()
      const content: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
        reader.onload = () => resolve((reader.result as string) ?? '')
        reader.readAsText(file)
      })
      const path = await uploadFile(file.name, content)
      return path ?? undefined
    },
    [uploadFile],
  )

  const onSearchReferences = useCallback(
    (token: string) => {
      const t = token.trim().toLowerCase()
      const out: { value: string; label: string; description?: string }[] = []
      for (const story of Object.values(storiesById)) {
        const sIdx = getStoryDisplayIndex(story.id)
        const sLabel = sIdx != null ? `${sIdx} · ${story.title}` : story.title
        if (
          !t ||
          story.title.toLowerCase().includes(t) ||
          (sIdx != null && String(sIdx).startsWith(t))
        ) {
          out.push({
            value: sIdx != null ? String(sIdx) : story.id,
            label: sLabel,
            description: 'Story',
          })
        }
        for (const f of story.features ?? []) {
          const feature = featuresById[f.id] ?? f
          if (!feature) continue
          const fIdx = getFeatureDisplayIndex(story.id, feature.id)
          const refValue =
            sIdx != null && fIdx != null ? `${sIdx}.${fIdx}` : `${story.id}.${feature.id}`
          if (
            !t ||
            feature.title.toLowerCase().includes(t) ||
            refValue.toLowerCase().startsWith(t)
          ) {
            out.push({
              value: refValue,
              label: `${refValue} · ${feature.title}`,
              description: `Feature in ${story.title}`,
            })
          }
        }
        if (out.length >= 50) break
      }
      return out.slice(0, 8)
    },
    [storiesById, featuresById, getStoryDisplayIndex, getFeatureDisplayIndex],
  )

  return (
    <ChatInputBase
      {...props}
      filePaths={filePaths}
      onUploadAttachment={onUploadAttachment}
      onSearchReferences={onSearchReferences}
    />
  )
}
