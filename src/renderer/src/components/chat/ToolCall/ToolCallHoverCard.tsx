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
import { StoryUpdatePreview, FeatureUpdatePreview } from './components/StoryFeatureUpdatePreview'
import ListStoriesPreview, { coerceStoriesList } from './components/ListStoriesPreview'

import { extract, isCompletelyNewFile, tryString } from './utils'
import { StoryCardRaw } from '@renderer/components/stories/StoryCard'
import { WriteToolsPreview } from './renderers/WriteToolsPreview'
import { WriteMultiToolsPreview } from './renderers/WriteMultiToolsPreview'
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

    // writeExactReplaces has multiple changes; keep headerPath empty (handled by preview)
    if (toolName === 'writeExactReplaces') return undefined

    if (toolName === 'readFileRanges') return undefined

    if (toolName === 'readFileStructure') return tryString(extract(args, ['path']))

    if (toolName === 'grepFiles') return undefined

    if (toolName === 'listContents') return tryString(extract(args, ['path']))
    if (toolName === 'getAstOutline') return tryString(extract(args, ['path']))
    return undefined
  })()

  const headerPath: string | undefined = toolPrimaryPath

  const [sideBySide, setSideBySide] = useState<boolean>(false)

  // Split-toggle rules:
  // - writeFile: allow only when it is NOT a completely new file.
  // - text tools: allow only while in-flight (once finished we only show new content).
  const canShowSplitToggle = useMemo(() => {
    if (toolName === 'writeFile') {
      const isNew = isCompletelyNewFile(result)
      return !isNew
    }

    if (toolName === 'updateStory' || toolName === 'updateFeature') {
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
    if (n === 'writeExactReplaces') {
      return (
        <WriteMultiToolsPreview
          toolCall={toolCall}
          result={result}
          resultType={resultType}
          projectId={projectId}
        />
      )
    }

    if (n === 'writeFile') {
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

    if (n === 'updateStory') {
      const storyId = tryString(extract(args, ['storyId']))
      const patch = (extract(args, ['patch']) || {}) as Record<string, unknown>
      const story = storyId ? storiesById[storyId] : undefined

      return (
        <StoryUpdatePreview
          project={project}
          story={story}
          patch={patch}
          result={result}
          sideBySide={sideBySide}
          isComplete={!isInFlight}
        />
      )
    }

    if (n === 'updateFeature') {
      const storyId = tryString(extract(args, ['storyId']))
      const featureId = tryString(extract(args, ['featureId']))
      const patch = (extract(args, ['patch']) || {}) as Record<string, unknown>
      const story = storyId ? storiesById[storyId] : undefined
      const feature = featureId ? featuresById[featureId] : undefined

      return (
        <FeatureUpdatePreview
          project={project}
          story={story}
          feature={feature}
          patch={patch}
          result={result}
          sideBySide={sideBySide}
          isComplete={!isInFlight}
        />
      )
    }

    // ── existing local renderers ──
    if (n === 'readPaths') {
      const files: string[] = Array.isArray(extract(args, ['paths']))
        ? extract(args, ['paths'])
        : []
      const withLineNumbers = extract(args, ['lineNumbers'])
      const resultMap = result && typeof result === 'object' && !Array.isArray(result) ? result : {}

      return (
        <div className="text-xs space-y-1">
          {withLineNumbers ? (
            <div className="mb-2">{/* <SmallBadge>lineNumbers</SmallBadge> */}</div>
          ) : null}
          {files.length > 0 ? (
            files.map((file, idx) => {
              const content = typeof resultMap[file] === 'string' ? resultMap[file] : undefined
              const suffix =
                resultType === 'success' && typeof content === 'string'
                  ? `: ${content.length} chars`
                  : ''

              return (
                <Row key={file || idx} className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px]">{file || '(unknown)'}</span>
                  {suffix ? (
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {suffix}
                    </span>
                  ) : null}
                </Row>
              )
            })
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No paths</div>
          )}
        </div>
      )
    }

    if (n === 'readFileRanges') {
      const queries = extract(args, ['queries'])
      const safe = Array.isArray(queries) ? queries : []
      const resultMap = result && typeof result === 'object' && !Array.isArray(result) ? result : {}

      const anyWithLineNumbers = safe.some((q: any) => extract(q, ['lineNumbers']))

      return (
        <div className="text-xs space-y-1">
          {anyWithLineNumbers ? (
            <div className="mb-2 text-[10px] font-medium text-[var(--text-secondary)]">
              lineNumbers
            </div>
          ) : null}
          {safe.length > 0 ? (
            safe.map((q: any, idx: number) => {
              const path = tryString(extract(q, ['path'])) || '(unknown)'
              const startLine = extract(q, ['startLine'])
              const endLine = extract(q, ['endLine'])
              const content = typeof resultMap[path] === 'string' ? resultMap[path] : undefined
              const suffix =
                resultType === 'success' && typeof content === 'string'
                  ? `: ${content.length} chars`
                  : ''

              return (
                <Row key={`${path}-${idx}`} className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px]">
                    L{String(startLine ?? '?')}:L{String(endLine ?? '?')} {path}
                  </span>
                  {suffix ? (
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {suffix}
                    </span>
                  ) : null}
                </Row>
              )
            })
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No queries</div>
          )}
        </div>
      )
    }

    if (n === 'grepFiles') {
      const queries = extract(args, ['queries'])
      const safe = Array.isArray(queries) ? queries : []
      const resultMap = result && typeof result === 'object' && !Array.isArray(result) ? result : {}

      return (
        <div className="text-xs space-y-2">
          {safe.length > 0 ? (
            safe.map((q: any, idx: number) => {
              const path = tryString(extract(q, ['path'])) || '(unknown)'
              const pattern = tryString(extract(q, ['pattern'])) || ''
              const matches = Array.isArray(resultMap[path]) ? resultMap[path] : undefined
              const suffix =
                resultType === 'success' && matches ? `: ${matches.length} matches` : ''

              return (
                <div key={`${path}-${idx}`} className="space-y-0.5">
                  <Row>
                    <span className="font-mono text-[11px] break-words">
                      {pattern || '(no pattern)'}
                    </span>
                  </Row>
                  <Row className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px]">{path}</span>
                    {suffix ? (
                      <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                        {suffix}
                      </span>
                    ) : null}
                  </Row>
                </div>
              )
            })
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No queries</div>
          )}
        </div>
      )
    }

    if (n === 'compileCheck') {
      const paths = (extract(args, ['paths']) ?? []) as Array<string | undefined>
      const safePaths = paths.filter((p): p is string => typeof p === 'string')
      const strict = extract(args, ['strict'])

      const failingPathsRaw =
        extract(result, ['failingPaths']) ||
        extract(result, ['failedPaths']) ||
        extract(result, ['errorsByFile']) ||
        extract(result, ['failuresByPath']) ||
        extract(result, ['files'])

      const failingPaths: string[] = Array.isArray(failingPathsRaw)
        ? failingPathsRaw.filter((p: any): p is string => typeof p === 'string')
        : failingPathsRaw && typeof failingPathsRaw === 'object'
          ? Object.keys(failingPathsRaw)
          : []

      const shownPaths = resultType === 'success' ? failingPaths : safePaths

      return (
        <div className="text-xs space-y-1">
          <Row className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[var(--text-secondary)]">strict:</span>
            <span className="font-mono text-[11px]">{String(!!strict)}</span>
          </Row>

          {shownPaths.length > 0 ? (
            <div>
              <SectionTitle>{resultType === 'success' ? 'Failing paths' : 'Paths'}</SectionTitle>
              <PreLimited lines={shownPaths} maxLines={10} />
            </div>
          ) : resultType === 'success' ? (
            <div className="text-[11px] text-[var(--text-secondary)]">No failing paths</div>
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No paths</div>
          )}
        </div>
      )
    }

    if (n === 'gitResetFiles') {
      const paths = (extract(args, ['paths']) ?? []) as Array<string | undefined>
      const safePaths = paths.filter((p): p is string => typeof p === 'string')

      return (
        <div className="text-xs space-y-1">
          {safePaths.length > 0 ? (
            safePaths.map((file, idx) => (
              <Row key={`${file}-${idx}`}>
                <span className="font-mono text-[11px]">{file}</span>
              </Row>
            ))
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No paths</div>
          )}
        </div>
      )
    }

    if (n === 'gitDiff') {
      const options = extract(args, ['options']) || {}
      const paths = (extract(options, ['paths']) ?? []) as Array<string | undefined>
      const safePaths = paths.filter((p): p is string => typeof p === 'string')
      const staged = extract(options, ['staged'])
      const includePatch = extract(options, ['includePatch'])
      const includeStructured = extract(options, ['includeStructured'])

      const files = (extract(result, ['files']) ??
        extract(result, ['diffs']) ??
        extract(result, ['entries']) ??
        []) as any[]

      return (
        <div className="text-xs space-y-1">
          <Row className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[var(--text-secondary)]">mode:</span>
            <span className="font-mono text-[11px]">{staged ? 'staged' : 'unstaged'}</span>
            {includePatch ? (
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">patch</span>
            ) : null}
            {includeStructured ? (
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                structured
              </span>
            ) : null}
          </Row>

          {safePaths.length > 0 ? (
            <div>
              <SectionTitle>Paths</SectionTitle>
              <PreLimited lines={safePaths} maxLines={10} />
            </div>
          ) : null}

          {resultType === 'success' ? (
            files.length > 0 ? (
              <div>
                <SectionTitle>Results</SectionTitle>
                <div className="space-y-1">
                  {files.map((file: any, idx: number) => {
                    const path =
                      tryString(extract(file, ['path'])) ||
                      tryString(extract(file, ['newPath'])) ||
                      tryString(extract(file, ['oldPath'])) ||
                      `(entry ${idx + 1})`
                    const added = extract(file, ['addedLines']) ?? extract(file, ['additions'])
                    const removed = extract(file, ['removedLines']) ?? extract(file, ['deletions'])
                    const truncated = !!extract(file, ['patchTruncated'])

                    return (
                      <Row key={`${path}-${idx}`} className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px]">{path}</span>
                        {typeof added === 'number' ? (
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            +{added}
                          </span>
                        ) : null}
                        {typeof removed === 'number' ? (
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            -{removed}
                          </span>
                        ) : null}
                        {truncated ? (
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                            patch truncated
                          </span>
                        ) : null}
                      </Row>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-secondary)]">No diff results</div>
            )
          ) : null}
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

    if (n === 'listStories') {
      const stories = coerceStoriesList(result)
      return <ListStoriesPreview stories={stories} />
    }

    if (n === 'getAstOutline') {
      const raw = extract(result, ['result']) || extract(result, ['nodes']) || result
      const items = Array.isArray(raw) ? raw : []

      return (
        <div className="text-xs space-y-1">
          {items.length > 0 ? (
            <div>
              <SectionTitle>AST Outline</SectionTitle>
              <PreLimited
                lines={items.map(
                  (it: any) =>
                    `${String(it.kind || '').padEnd(25)} ${it.name} (L${it.startLine}-L${it.endLine})`,
                )}
                maxLines={15}
                renderTruncationMessage={(omitted) => <>+ {omitted} more nodes</>}
              />
            </div>
          ) : resultType === 'success' ? (
            <div className="text-[11px] text-[var(--text-secondary)]">No nodes</div>
          ) : null}
        </div>
      )
    }

    if (n === 'getCode') {
      const requestedNamesRaw = extract(args, ['names'])
      const requestedNames: string[] = Array.isArray(requestedNamesRaw)
        ? requestedNamesRaw.filter((it: any): it is string => typeof it === 'string')
        : []

      const rawResults =
        extract(result, ['result']) ||
        extract(result, ['results']) ||
        extract(result, ['items']) ||
        result

      const resultCount = Array.isArray(rawResults)
        ? rawResults.length
        : rawResults && typeof rawResults === 'object'
          ? Object.keys(rawResults).length
          : 0

      return (
        <div className="text-xs space-y-1">
          <SectionTitle>Names</SectionTitle>
          {requestedNames.length > 0 ? (
            <PreLimited lines={requestedNames} maxLines={10} />
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No names</div>
          )}

          {resultType === 'success' ? (
            <div>
              <SectionTitle>Results</SectionTitle>
              <div className="text-[11px] text-[var(--text-secondary)]">
                {resultCount} result{resultCount === 1 ? '' : 's'}
              </div>
            </div>
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

    if (n === 'deletePath') {
      const delPath = tryString(extract(args, ['path']))
      return <InlineOldNew oldVal={delPath} newVal={'(deleted)'} />
    }

    if (n === 'addFeature') {
      const storyId = tryString(extract(args, ['storyId']))
      const featureInput = (extract(args, ['featureInput']) || {}) as any
      const resultStory = result && typeof result === 'object' ? result : undefined
      const isComplete = !isInFlight && !!resultStory?.id
      const story = isComplete ? { ...resultStory } : ({ id: storyId } as any)
      const feature = isComplete
        ? story.features?.[story.features.length - 1]
        : ({
            ...featureInput,
            id: 'new-feature',
          } as any)
      const featureId = tryString(feature?.id)
      const navigateStoryId = tryString(resultStory?.id) || storyId

      return (
        <FeatureCardRaw
          project={project!}
          story={story}
          feature={feature}
          isNew={!isComplete}
          onPillClick={
            isComplete && navigateStoryId && featureId
              ? () => navigateStoryDetails(navigateStoryId, featureId)
              : undefined
          }
        />
      )
    }

    if (n === 'addStory') {
      const storyInput = (extract(args, ['input']) || {}) as any
      const isComplete = !isInFlight && !!result?.id
      return (
        <StoryCardRaw
          project={project!}
          story={result || storyInput}
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
    if (n === 'searchFiles' || n === 'searchFilePaths' || n === 'searchFilesAndRead') {
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

  const isSmall = toolName === 'finishFeature' || toolName === 'blockFeature'

  return (
    <div
      className={`${isSmall ? 'min-w-[120px] max-w-[70vw]' : 'w-[480px] max-w-[70vw]'} rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-2 shadow-[var(--shadow-2)]`}
    >
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
