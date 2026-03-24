import React, { useMemo, useState } from 'react'
import type { Story, ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../../ui/Code'
import { FeatureCardRaw } from '../../stories/FeatureCard'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useActiveProject } from '@renderer/contexts/ProjectContext'

import { StatusIcon } from './components/StatusIcon'
import { SectionTitle } from './components/SectionTitle'
import { Row } from './components/Row'
import { PreLimited } from './components/PreLimited'
import { InlineOldNew } from './components/InlineOldNew'
import { NewContentOnly } from './components/NewContentOnly'
import { ReorderList } from './components/ReorderList'

import { extract, isCompletelyNewFile, tryString } from './utils'
import { StoryCardRaw } from '@renderer/components/stories/StoryCard'
import { WriteToolsPreview } from './renderers/WriteToolsPreview'
import { TextToolsPreview } from './renderers/TextToolsPreview'
import StoryAndFeatureCallout from '@renderer/components/stories/StoryAndFeatureCallout'

import { useNavigator } from '@renderer/navigation/Navigator'

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
  const { projectId, project } = useActiveProject()
  const { storiesById, featuresById } = useStories()
  const { navigateStoryDetails } = useNavigator()

  const args = toolCall?.arguments || {}
  const toolName = String(name)

  const isInFlight =
    resultType === 'pending' || resultType === 'running' || resultType === 'require_confirmation'

  const toolPrimaryPath: string | undefined = (() => {
    if (toolName === 'writeFile') return tryString(extract(args, ['path']))
    if (toolName === 'writeExactReplace') return tryString(extract(args, ['path']))
    if (toolName === 'readFileRange') return tryString(extract(args, ['path']))
    if (toolName === 'readFileStructure') return tryString(extract(args, ['path']))
    if (toolName === 'grepFile') return tryString(extract(args, ['path']))
    if (toolName === 'listContents') return tryString(extract(args, ['path']))
    return undefined
  })()

  const headerPath: string | undefined = toolPrimaryPath

  const [sideBySide, setSideBySide] = useState<boolean>(false)

  // Split-toggle rules:
  // - write tools: allow only when it is NOT a completely new file.
  // - text tools: allow only while in-flight (once finished we only show new content).
  const canShowSplitToggle = useMemo(() => {
    if (toolName === 'writeFile' || toolName === 'writeExactReplace') {
      const isNew = toolName === 'writeFile' ? isCompletelyNewFile(result) : false
      return !isNew
    }

    if (toolName === 'updateStoryDescription' || toolName === 'updateFeatureDescription') {
      return isInFlight
    }

    return false
  }, [toolName, result, isInFlight])

  // If we hide the split toggle, force inline view.
  useMemo(() => {
    if (!canShowSplitToggle && sideBySide) setSideBySide(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShowSplitToggle])

  const content = useMemo(() => {
    const args = toolCall?.arguments || {}
    const n = String(name)

    if (resultType === 'errored') {
      const msg = tryString(
        extract(result, ['message']) || extract(result, ['error']) || extract(result, ['result']),
      )
      const label = msg ? 'Error' : 'Error (no details)'
      return <NewContentOnly text={msg} label={label} />
    }

    // ── extracted renderers ──
    if (n === 'writeFile' || n === 'writeExactReplace') {
      return (
        <WriteToolsPreview
          toolCall={toolCall}
          result={result}
          resultType={resultType}
          sideBySide={sideBySide}
          projectId={projectId}
        />
      )
    }

    if (n === 'updateStoryDescription' || n === 'updateFeatureDescription') {
      return (
        <TextToolsPreview
          toolCall={toolCall}
          result={result}
          resultType={resultType}
          sideBySide={sideBySide}
          projectId={projectId}
          storiesById={storiesById}
          featuresById={featuresById}
        />
      )
    }

    // ── existing local renderers ──
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

    if (n === 'deletePath') {
      const delPath = tryString(extract(args, ['path']))
      return <InlineOldNew oldVal={delPath} newVal={'(deleted)'} />
    }

    //TODO: fix incomplete args (no storyId/featureId) + hacks
    if (n === 'createFeature') {
      const isComplete = !isInFlight && !!result?.id
      const storyId = args.storyId
      const story = isComplete ? { ...result } : ({ id: storyId } as any)
      const feature = isComplete ? story.features[story.features.length - 1] : ({ ...args } as any)
      return (
        <FeatureCardRaw
          project={project!}
          story={story}
          feature={feature}
          isNew={!isComplete}
          onPillClick={isComplete ? () => navigateStoryDetails(storyId, result.id) : undefined}
        />
      )
    }

    //TODO: fix incomplete args
    if (n === 'createStory') {
      const isComplete = !isInFlight && !!result?.id
      return (
        <StoryCardRaw
          project={project!}
          story={result || args}
          isNew={!isComplete}
          onPillClick={
            isComplete ? () => navigateStoryDetails(result.id, undefined, true) : undefined
          }
        />
      )
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

    if (n === 'finishFeature' || n === 'blockFeature') {
      const storyId = tryString(extract(args, ['storyId']))
      const featureId = tryString(extract(args, ['featureId']))
      return (
        <div className="p-2">
          <StoryAndFeatureCallout storyId={storyId} featureId={featureId} />
        </div>
      )
    }

    if (n === 'searchFilesByExact' || n === 'searchFilesByKeywords') {
      const qLines: string[] = extract(args, ['needles']) || extract(args, ['keywords']) || ['']
      let resultLines: string[] = result

      return (
        <div className="text-xs space-y-1">
          <SectionTitle>Query:</SectionTitle>
          <PreLimited lines={qLines} maxLines={10} />

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
    if (n === 'searchFiles' || n === 'searchFilePaths') {
      const query = tryString(extract(args, ['query']) || extract(result, ['query'])) || ''
      let resultLines: string[] = result

      const qLines = query.split(/\r?\n/)

      return (
        <div className="text-xs space-y-1">
          <SectionTitle>Query:</SectionTitle>
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

    return <Code language="json" code={str} />
  }, [toolCall, name, result, resultType, storiesById, featuresById, sideBySide, projectId])

  return (
    <div className="w-[480px] max-w-[70vw] rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-2)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIcon resultType={resultType} />
          <div className="text-sm font-semibold">{toolName}</div>
        </div>

        {canShowSplitToggle ? (
          <div className="flex bg-[var(--surface-base)] rounded-md border border-[var(--border-subtle)] p-0.5 gap-0.5">
            <button
              onClick={() => setSideBySide(false)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${!sideBySide ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              title="Inline Unified View"
              type="button"
            >
              Inline
            </button>
            <button
              onClick={() => setSideBySide(true)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${sideBySide ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              title="Split Side-by-Side View"
              type="button"
            >
              Split
            </button>
          </div>
        ) : null}
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
