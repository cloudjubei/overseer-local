import React, { useMemo } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../../../ui/Code'
import Spinner from '../../../ui/Spinner'
import { StructuredUnifiedDiff } from '../../tool-popups/diffUtils'
import { buildUnifiedDiffIfPresent, extract, isCompletelyNewFile, tryString } from '../utils'

export function WriteToolsPreview({
  toolCall,
  result,
  resultType,
  sideBySide,
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

  // Check for explicit error in result, even if resultType isn't 'errored'
  const resultError = useMemo(() => {
    if (resultType === 'errored') {
      return (
        tryString(extract(result, ['message']) || extract(result, ['error']) || result) ||
        'Tool errored'
      )
    }
    const err = extract(result, ['error'])
    if (err) return tryString(err.message || err)
    return undefined
  }, [result, resultType])

  const isPreviewObject = result && typeof result === 'object' && 'status' in result

  if (isPreviewObject && result.status === 'error') {
    return errorContent(result.error || 'Preview failed')
  }

  // Unwrap the actual tool data from the ToolPreview if it is 'ready',
  // otherwise use the result directly (which means it's an executed tool result).
  const actualData = useMemo(() => {
    if (isPreviewObject) {
      if (result.status === 'ready') {
        // The ready patch might be a parsed array of file diff objects (from writeExactReplaces preview)
        // or a raw concatenated diff string.
        try {
          if (typeof result.patch === 'string' && toolName === 'writeExactReplaces') {
            const parsed = JSON.parse(result.patch)
            if (Array.isArray(parsed)) return parsed
          }
        } catch (e) {
          // ignore
        }
        return result.patch
      }
      return undefined // pending or error
    }
    return result
  }, [result, isPreviewObject, toolName])

  // When the tool succeeds, we expect a diff in the tool result.
  // writeExactReplaces may produce multiple diffs (one per file); handle that by building a
  // concatenated patch string for display.
  const successPatch = useMemo(() => {
    // Multi-write: actualData could be WriteExactReplaceResult[] directly.
    if (Array.isArray(actualData)) {
      const patches = actualData
        .map((r: any) => buildUnifiedDiffIfPresent(r) || tryString(extract(r, ['diff', 'patch'])))
        .filter((p: any): p is string => typeof p === 'string' && p.length > 0)

      if (patches.length > 0) return patches.join('\n')
    }
    // Preferred: unified diff is already present somewhere in the result (single-file tools).
    const single = buildUnifiedDiffIfPresent(actualData)
    if (single) return single

    // If actualData is just a string (e.g. from preview tool fallback), return it
    if (typeof actualData === 'string') return actualData

    return undefined
  }, [actualData])

  // Determine whether this is a brand new file (affects split toggle & banner)
  const isNewFile: boolean =
    toolName === 'writeFile' ? isCompletelyNewFile(actualData, successPatch) : false

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
  if (resultError) return errorContent(resultError)

  const patchToShow = successPatch

  if (isPreviewObject && result.status === 'pending') return spinnerContent('Loading diff preview…')

  if (!patchToShow) {
    if (isInFlight) return spinnerContent('Loading diff preview…')
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
