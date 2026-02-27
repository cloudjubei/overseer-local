import React, { useEffect, useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../../../ui/Code'
import Spinner from '../../../ui/Spinner'
import { StructuredUnifiedDiff } from '../../tool-popups/diffUtils'

import { factoryToolsService } from '@renderer/services/factoryToolsService'

import { buildUnifiedDiffIfPresent, extract, isCompletelyNewFile, tryString } from '../utils'

type PreviewState = {
  loading: boolean
  error?: string
  patch?: string
}

export function WriteToolsPreview({
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
}) {
  const toolName = String(toolCall?.name)
  const args = toolCall?.arguments || {}

  const isInFlight =
    resultType === 'pending' || resultType === 'running' || resultType === 'require_confirmation'

  // When the tool succeeds, we expect a diff in the tool result.
  const successPatch = useMemo(() => {
    return buildUnifiedDiffIfPresent(result)
  }, [result])

  const [preview, setPreview] = useState<PreviewState>({ loading: false })

  // While in-flight (or require_confirmation), ask previewTool for the pre-tool-call diff.
  useEffect(() => {
    let cancelled = false

    async function run() {
      if (
        toolName !== 'writeFile' &&
        toolName !== 'writeDiffToFile' &&
        toolName !== 'writeStructuredDiffToFile'
      ) {
        return
      }

      // If we already have a successful patch, no need to preview.
      if (successPatch) {
        setPreview({ loading: false })
        return
      }

      if (!isInFlight) {
        // Not in-flight and no patch: nothing to show.
        setPreview({ loading: false })
        return
      }

      if (!projectId) {
        setPreview({ loading: true })
        return
      }

      setPreview({ loading: true })

      try {
        const res = await factoryToolsService.previewTool(projectId, toolName, args)
        if (cancelled) return

        const patch = buildUnifiedDiffIfPresent(res) || tryString(extract(res, ['diff']))
        setPreview({ loading: false, patch })
      } catch (error: any) {
        if (cancelled) return
        const message = tryString(error?.message) || tryString(error) || 'Failed to load preview'
        setPreview({ loading: false, error: message })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [toolName, args, projectId, isInFlight, successPatch])

  // Determine whether this is a brand new file (affects split toggle & banner)
  const isNewFile: boolean =
    toolName === 'writeFile' ? isCompletelyNewFile(result, successPatch || preview.patch) : false

  function spinnerContent(label?: string): React.ReactNode {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={20} label={label ?? 'Loading preview…'} />
      </div>
    )
  }

  function errorContent(message: string): React.ReactNode {
    return (
      <div className="text-xs text-red-500 py-2 px-1">
        <span className="font-semibold">Error:</span> {message}
      </div>
    )
  }

  function newFileBanner(): React.ReactNode {
    return <div className="mb-2 text-red-500 font-extrabold text-lg tracking-wide">NEW FILE</div>
  }

  // writeFile, writeDiffToFile, writeStructuredDiffToFile are display-equivalent: all are diffs.
  const patchToShow = successPatch || preview.patch

  if (preview.error) return errorContent(preview.error)

  if (!patchToShow) {
    if (isInFlight || preview.loading) return spinnerContent('Loading diff preview…')
    return <div className="text-[11px] text-[var(--text-secondary)]">No diff output</div>
  }

  // If patch looks like a unified diff, use the nice renderer.
  const isUnified = patchToShow.includes('@@')

  if (isNewFile) {
    return (
      <div>
        {newFileBanner()}
        <Code code={patchToShow} language="diff" />
      </div>
    )
  }

  if (isUnified) {
    return <StructuredUnifiedDiff patch={patchToShow} sideBySide={sideBySide} />
  }

  return <Code code={patchToShow} language="diff" />
}
