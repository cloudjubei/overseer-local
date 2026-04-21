import { useEffect, useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Spinner from '../../../ui/Spinner'

import { factoryToolsService } from '@renderer/services/factoryToolsService'

import { buildSimpleUnifiedDiff, extract, tryString } from '../utils'
import { NewContentOnly } from '../components/NewContentOnly'
import { SimpleSplitText } from '../../tool-popups/SimpleUnifiedDiff'
import { InlineTextDiff } from '../../tool-popups/InlineTextDiff'

type DescPreview = { diff: string; new: string; old: string }

export function TextToolsPreview({
  toolCall,
  result,
  resultType,
  sideBySide,
  projectId,
}: {
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
  sideBySide: boolean
  projectId?: string
  storiesById: Record<string, any>
  featuresById: Record<string, any>
}) {
  const toolName = String(toolCall?.name)
  const args = toolCall?.arguments || {}

  const isInFlight =
    resultType === 'pending' || resultType === 'running' || resultType === 'require_confirmation'

  // New description comes from the tool call args.
  const newDescriptionArg = useMemo(() => {
    return tryString(extract(args, ['description']))
  }, [args])

  const [descPreview, setDescPreview] = useState<DescPreview | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!projectId) return
      if (!isInFlight) {
        setDescPreview(undefined)
        return
      }

      const newText = newDescriptionArg
      if (typeof newText !== 'string') {
        setDescPreview(undefined)
        return
      }

      try {
        const preview = (await factoryToolsService.previewTool(projectId, toolName, args)) as
          | DescPreview
          | undefined

        if (cancelled) return
        setDescPreview(preview)
      } catch {
        if (!cancelled) setDescPreview(undefined)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [projectId, toolName, args, isInFlight, newDescriptionArg])

  const patch = useMemo(() => {
    if (!isInFlight) return undefined
    return buildSimpleUnifiedDiff(toolName, descPreview?.old, descPreview?.new)
  }, [toolName, isInFlight, descPreview])

  if (isInFlight) {
    if (!projectId || !descPreview) {
      return (
        <div className="flex items-center justify-center py-4">
          <Spinner size={20} label="Loading preview…" />
        </div>
      )
    }

    if (sideBySide) {
      return (
        <SimpleSplitText
          oldText={descPreview.old}
          newText={descPreview.new}
          oldLabel="Before"
          newLabel="After"
        />
      )
    }

    if (patch) {
      return <InlineTextDiff patch={patch} intraline="word" showDeletions={true} />
    }

    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={20} label="Loading preview…" />
      </div>
    )
  }

  const finalText = tryString(extract(result, ['description']))

  return <NewContentOnly text={finalText} label={'Updated description'} />
}
