import React, { useEffect, useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../../ui/Code'
import { StructuredUnifiedDiff } from '../tool-popups/diffUtils'
import FeatureSummaryCard from '../../stories/FeatureSummaryCard'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { filesService } from '@renderer/services/filesService'

import { StatusIcon } from './components/StatusIcon'
import { SectionTitle } from './components/SectionTitle'
import { Row } from './components/Row'
import { PreLimited } from './components/PreLimited'
import { InlineOldNew } from './components/InlineOldNew'
import { NewContentOnly } from './components/NewContentOnly'
import { ReorderList } from './components/ReorderList'

import {
  buildSimpleUnifiedDiff,
  buildUnifiedDiffIfPresent,
  extract,
  isCompletelyNewFile,
  looksLikeDiffPatchText,
  tryString,
} from './utils'
import StorySummaryCard from '@renderer/components/stories/StorySummaryCard'

export default function ToolCallHoverCard({
  toolCall,
  result,
  resultType,
}: {
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
}) {
  const name = toolCall?.name || 'tool'
  const { projectId } = useActiveProject()
  const { storiesById, featuresById } = useStories()

  const args = toolCall?.arguments || {}
  const toolName = String(name)

  const toolPrimaryPath: string | undefined = (() => {
    // Used for headers/labels. Keep this conservative and only for tools that clearly have a 'path'.
    if (toolName === 'writeFile') return tryString(extract(args, ['path']))
    if (toolName === 'writeDiffToFile') return tryString(extract(args, ['path']))
    if (toolName === 'readFileRange') return tryString(extract(args, ['path']))
    if (toolName === 'readFileStructure') return tryString(extract(args, ['path']))
    if (toolName === 'grepFile') return tryString(extract(args, ['path']))
    if (toolName === 'listContents') return tryString(extract(args, ['path']))
    return undefined
  })()

  const headerPath: string | undefined = toolPrimaryPath

  const writeFileNewText: string | undefined = (() => {
    if (toolName !== 'writeFile') return undefined
    const content = extract(args, ['content'])
    if (typeof content === 'string') return content
    return tryString(content)
  })()

  const writeFileResultDiff = buildUnifiedDiffIfPresent(result)

  const [computedDiff, setComputedDiff] = useState<string | undefined>(undefined)
  const [computedIsNewFile, setComputedIsNewFile] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (toolName !== 'writeFile') return
      if (!toolPrimaryPath) return
      if (typeof writeFileNewText !== 'string') return

      try {
        const beforeText = projectId
          ? await filesService.readFile(projectId, toolPrimaryPath)
          : undefined

        if (cancelled) return

        const diff = buildSimpleUnifiedDiff(toolPrimaryPath, beforeText, writeFileNewText)
        setComputedDiff(diff)
        setComputedIsNewFile(beforeText == null)
      } catch {
        // If we can't read the file, just skip computed diff.
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [toolName, toolPrimaryPath, writeFileNewText, projectId])

  function errorContentOnly(): React.ReactNode {
    const msg = tryString(
      extract(result, ['message']) || extract(result, ['error']) || extract(result, ['result']),
    )
    const label = msg ? 'Error' : 'Error (no details)'
    return <NewContentOnly text={msg} label={label} />
  }

  const content = useMemo(() => {
    const args = toolCall?.arguments || {}
    const n = String(name)

    if (resultType === 'errored') {
      return errorContentOnly()
    }

    if (n === 'readPaths') {
      const files: string[] = extract(args, ['paths']) ?? []

      return (
        <div className="text-xs space-y-1">
          {files.map((file, idx) => (
            <Row key={file || idx}>
              <span className="font-mono text-[11px]">{file || '(unknown)'}</span>
            </Row>
          ))}
        </div>
      )
    }

    if (n === 'webReadURLs') {
      // Treat identical to 'readPaths'
      const urls = (extract(args, ['urls']) ?? []) as Array<string | undefined>
      const safeUrls = urls.filter((u): u is string => typeof u === 'string')

      return (
        <div className="text-xs space-y-1">
          {safeUrls.map((url, idx) => (
            <Row key={url || idx}>
              <span className="font-mono text-[11px]">{url || '(unknown)'}</span>
            </Row>
          ))}
        </div>
      )
    }

    if (n === 'webSearch') {
      const query = tryString(extract(args, ['query'])) || ''
      const qLines = query.split(/\r?\n/)

      // When done, output titles of items returned.
      const rawItems =
        extract(result, ['items']) ||
        extract(result, ['results']) ||
        extract(result, ['data.items']) ||
        extract(result, ['data.results'])

      const titles: string[] = Array.isArray(rawItems)
        ? (rawItems
            .flatMap((it: any) => {
              const t =
                tryString(extract(it, ['title'])) ||
                tryString(extract(it, ['name'])) ||
                tryString(it?.title) ||
                tryString(it?.name)
              return t ? [t] : []
            })
            .filter((t: string) => !!t) as string[])
        : []

      return (
        <div className="text-xs space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Query:</span>
          </Row>
          <PreLimited lines={qLines} maxLines={2} />

          {resultType === 'success' ? (
            titles.length > 0 ? (
              <div>
                <SectionTitle>Results</SectionTitle>
                <PreLimited
                  lines={titles}
                  maxLines={10}
                  renderTruncationMessage={(omitted) => <>+ {omitted} more</>}
                />
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-secondary)]">No results</div>
            )
          ) : null}
        </div>
      )
    }

    if (n === 'listContents' || n === 'getInterface') {
      // Display vertically to avoid horizontal scrolling regressions.
      const raw =
        extract(result, ['result']) ||
        extract(result, ['results']) ||
        extract(result, ['items']) ||
        extract(result, ['files']) ||
        extract(result, ['paths']) ||
        result

      const items: string[] = Array.isArray(raw)
        ? raw
            .flatMap((it: any) => {
              if (typeof it === 'string') return [it]
              const p = tryString(extract(it, ['path', 'name', 'id', 'key', 'title']))
              if (p) return [p]
              const s = tryString(it)
              return s ? [s] : []
            })
            .filter(Boolean)
        : typeof raw === 'string'
          ? raw.split(/\r?\n/).filter(Boolean)
          : []

      return (
        <div className="text-xs space-y-1">
          {items.length > 0 ? (
            items.map((line, idx) => (
              <Row key={`${line}-${idx}`}>
                <span className="font-mono text-[11px]">{line}</span>
              </Row>
            ))
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No results</div>
          )}
        </div>
      )
    }

    if (n === 'renamePath') {
      const srcPath = tryString(extract(args, ['src'])) || tryString(extract(result, ['src']))
      const dstPath = tryString(extract(args, ['dst'])) || tryString(extract(result, ['dst']))

      return <InlineOldNew oldVal={srcPath} newVal={dstPath} />
    }

    if (n === 'updateStoryTitle') {
      const oldVal = result ? undefined : storiesById[args.storyId]?.title
      const newVal = tryString(extract(args, ['title']))
      return <InlineOldNew oldVal={oldVal} newVal={newVal} />
    }

    if (n === 'updateFeatureTitle') {
      const oldVal = result ? undefined : featuresById[args.featureId]?.title
      const newVal = tryString(extract(args, ['title']))
      return <InlineOldNew oldVal={oldVal} newVal={newVal} />
    }

    if (n === 'writeDiffToFile') {
      const patchText = buildUnifiedDiffIfPresent(result) || tryString(extract(args, ['diff']))
      if (patchText) {
        // Prefer the nicer structured diff viewer when we have a unified diff.
        if (patchText.includes('@@')) return <StructuredUnifiedDiff patch={patchText} />
        return <Code code={patchText} language="diff" />
      }
      return <div className="text-[11px] text-[var(--text-secondary)]">No diff output</div>
    }

    if (n === 'writeFile') {
      const diff = writeFileResultDiff || computedDiff
      const newText = writeFileNewText
      const isNew = isCompletelyNewFile(result, writeFileResultDiff) || computedIsNewFile

      if (diff) {
        if (isNew) {
          return <NewContentOnly text={diff} label={headerPath} />
        }
        return <StructuredUnifiedDiff patch={diff} />
      }

      if (typeof newText === 'string') {
        return <NewContentOnly text={newText} />
      }

      return <div className="text-[11px] text-[var(--text-secondary)]">No content</div>
    }

    if (n === 'deletePath') {
      const delPath = tryString(extract(args, ['path']))
      return <InlineOldNew oldVal={delPath} newVal={'(deleted)'} />
    }

    if (n === 'createFeature') {
      return <FeatureSummaryCard feature={args} />
    }

    if (n === 'createStory') {
      return <StorySummaryCard story={args} />
    }

    if (n === 'reorderFeature') {
      const feature = extract(result, ['feature']) || result
      const order =
        (extract(result, ['order']) ||
          extract(feature, ['order']) ||
          extract(feature, ['features'])) ??
        []
      const movedId = tryString(extract(args, ['featureId']) || extract(result, ['featureId']))

      if (Array.isArray(order)) {
        return <ReorderList items={order} movedId={movedId} />
      }
      return <div className="text-[11px] text-[var(--text-secondary)]">No reorder data</div>
    }

    if (n === 'searchFiles') {
      const query = tryString(extract(args, ['query']) || extract(result, ['query'])) || ''
      let resultLines: string[] = result

      const qLines = query.split(/\r?\n/)

      return (
        <div className="text-xs space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Query:</span>
          </Row>
          <PreLimited lines={qLines} maxLines={2} />

          {resultType === 'success' ? (
            resultLines.length > 0 ? (
              <div>
                <SectionTitle>Results</SectionTitle>
                <PreLimited
                  lines={resultLines}
                  maxLines={10}
                  renderTruncationMessage={(omitted) => <>+ {omitted} more</>}
                />
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-secondary)]">No matches</div>
            )
          ) : null}
        </div>
      )
    }

    if (n === 'runTests' || n === 'runAllTests' || n === 'runTestsCoverage') {
      const stats = extract(result, ['summary']) || {}
      const passed = extract(stats, ['passed']) || 0
      const failed = extract(stats, ['failed']) || 0
      const skipped = extract(stats, ['skipped']) || 0
      const total = extract(stats, ['total']) || 0
      const duration = extract(stats, ['durationMs']) || 0

      const testFiles = (extract(args, ['paths']) ?? []) as Array<string | undefined>
      const safeTestFiles = testFiles.filter((p): p is string => typeof p === 'string')

      return (
        <div className="text-xs space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Summary:</span>
          </Row>
          <Row>
            <span className="font-mono text-[11px]">passed={passed}</span>
            <span className="mx-1">·</span>
            <span className="font-mono text-[11px]">failed={failed}</span>
            <span className="mx-1">·</span>
            <span className="font-mono text-[11px]">skipped={skipped}</span>
            <span className="mx-1">·</span>
            <span className="font-mono text-[11px]">total={total}</span>
          </Row>
          <Row>
            <span className="font-mono text-[11px]">durationMs={duration}</span>
          </Row>

          {safeTestFiles.length > 0 ? (
            <div>
              <SectionTitle>Files</SectionTitle>
              <PreLimited lines={safeTestFiles} maxLines={10} />
            </div>
          ) : null}
        </div>
      )
    }

    // Fallback: show result or arguments.
    const str = (() => {
      if (result != null) {
        const s = tryString(result)
        if (s) return s
      }
      const a = tryString(args)
      return a || ''
    })()

    if (looksLikeDiffPatchText(str)) {
      return <Code language="diff" code={str} />
    }

    return <Code language="json" code={str} />
  }, [
    toolCall,
    name,
    result,
    resultType,
    storiesById,
    featuresById,
    writeFileResultDiff,
    computedDiff,
    computedIsNewFile,
    writeFileNewText,
    headerPath,
  ])

  return (
    <div className="w-[420px] max-w-[70vw] rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-2)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIcon resultType={resultType} />
          <div className="text-sm font-semibold">{toolName}</div>
        </div>
      </div>

      {headerPath ? (
        <div
          className="mt-1 font-mono text-[11px] text-[var(--text-secondary)] truncate"
          title={headerPath}
        >
          {headerPath}
        </div>
      ) : null}

      <div className="mt-2 max-h-[60vh] overflow-auto pr-1">{content}</div>
    </div>
  )
}
