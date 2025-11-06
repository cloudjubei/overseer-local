import React, { useEffect, useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../ui/Code'
import {
  IconCheckmarkCircle,
  IconError,
  IconStop,
  IconNotAllowed,
  IconHourglass,
} from '../ui/icons/Icons'
import { StructuredUnifiedDiff } from './tool-popups/diffUtils'
import FeatureSummaryCard from '../stories/FeatureSummaryCard'
import { filesService } from '../../services/filesService'
import { useActiveProject } from '../../contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'

function StatusIcon({ resultType }: { resultType?: ToolResultType }) {
  const size = 'w-3.5 h-3.5'
  switch (resultType) {
    case 'errored':
      return <IconError className={`${size} text-red-500`} />
    case 'aborted':
      return <IconStop className={`${size} text-orange-500`} />
    case 'not_allowed':
      return <IconNotAllowed className={`${size} text-neutral-500`} />
    case 'require_confirmation':
      return <IconHourglass className={`${size} text-teal-500`} />
    default:
      return <IconCheckmarkCircle className={`${size} text-green-500`} />
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1">{children}</div>
  )
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={['text-xs leading-relaxed', className || ''].join(' ')}>{children}</div>
}

function tryString(v: any): string | undefined {
  if (v == null) return undefined
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function InlineOldNew({ oldVal, newVal }: { oldVal?: string; newVal?: string }) {
  if (!newVal && !oldVal) return null
  return (
    <div className="text-xs">
      <span className="text-[var(--text-secondary)]">Title:</span>{' '}
      {oldVal ? <span className="line-through text-red-600/80 mr-1">{oldVal}</span> : null}
      {oldVal ? <span className="mx-1">→</span> : null}
      {newVal ? (
        <span className="font-semibold text-green-600 dark:text-green-400">{newVal}</span>
      ) : null}
    </div>
  )
}

function extract(obj: any, keys: string[]): any | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const parts = k.split('.')
    let cur: any = obj
    let ok = true
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
      else {
        ok = false
        break
      }
    }
    if (ok) return cur
  }
  return undefined
}

function buildUnifiedDiffIfPresent(result: any): string | undefined {
  if (!result) return undefined
  const raw =
    extract(result, ['diff']) ||
    extract(result, ['patch']) ||
    extract(result, ['unifiedDiff']) ||
    extract(result, ['result.patch']) ||
    extract(result, ['result.diff'])
  if (typeof raw === 'string' && raw.trim()) return raw
  const nestedPatch = extract(result, ['diff.patch'])
  if (typeof nestedPatch === 'string' && nestedPatch.trim()) return nestedPatch
  if (typeof result === 'string' && result.includes('@@')) return result
  return undefined
}

function isCompletelyNewFile(result: any, diff?: string): boolean {
  const before = extract(result, ['before', 'old', 'previous'])
  const after = extract(result, ['after', 'new'])
  if (!before && after) return true
  const isNewFlag = !!(extract(result, ['isNew']) || extract(result, ['newFile']))
  if (isNewFlag) return true
  if (typeof diff === 'string') {
    const lower = diff.toLowerCase()
    if (lower.includes('new file mode') || lower.includes('--- /dev/null')) return true
  }
  return false
}

function NewContentOnly({ text, label }: { text?: string; label?: string }) {
  const header = label || 'New content only. Diff unavailable.'
  if (!text) return <div className="text-xs text-[var(--text-secondary)]">{header}</div>
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)] mb-1">{header}</div>
      <Code language="text" code={text} />
    </div>
  )
}

function ReorderList({ items, movedId }: { items: any[]; movedId?: string }) {
  return (
    <ol className="list-decimal pl-5 text-xs space-y-0.5">
      {items.map((it: any, idx: number) => {
        const id = typeof it === 'string' ? it : it?.id || it?.key || it?.title || String(idx)
        const title = it?.title || id
        const moved = movedId && (it?.id === movedId || id === movedId)
        return (
          <li
            key={id}
            className={moved ? 'bg-yellow-200/40 dark:bg-yellow-800/30 rounded px-1' : ''}
          >
            <span className="text-[11px] text-[var(--text-secondary)] mr-1">{idx + 1}.</span>
            <span className="font-medium">{title}</span>
          </li>
        )
      })}
    </ol>
  )
}

function toLines(value: any): string[] {
  if (value == null) return []
  let str: string
  if (typeof value === 'string') str = value
  else {
    try {
      str = JSON.stringify(value, null, 2)
    } catch {
      str = String(value)
    }
  }
  return str.split(/\r?\n/)
}

function PreLimited({
  lines,
  maxLines,
  renderTruncationMessage,
}: {
  lines: string[]
  maxLines: number
  renderTruncationMessage?: (omitted: number) => React.ReactNode
}) {
  const limited = lines.slice(0, maxLines)
  const truncated = lines.length > maxLines
  const omitted = truncated ? lines.length - maxLines : 0
  return (
    <div>
      <pre className="text-[11px] text-[var(--text-primary)] bg-[var(--surface-raised)] p-1.5 rounded-md overflow-x-auto whitespace-pre">
        {limited.join('\n')}
      </pre>
      {truncated && renderTruncationMessage ? (
        <div className="text-[11px] text-[var(--text-secondary)] mt-1">
          {renderTruncationMessage(omitted)}
        </div>
      ) : null}
    </div>
  )
}

// Simple unified diff builder to fallback when the write_file result did not include a patch
function buildSimpleUnifiedDiff(
  path: string,
  beforeText?: string,
  afterText?: string,
): string | undefined {
  if (!path || typeof afterText !== 'string') return undefined
  const before = typeof beforeText === 'string' ? beforeText : ''
  if (before === afterText) return undefined
  const beforeLines = before.split(/\r?\n/)
  const afterLines = afterText.split(/\r?\n/)
  const header = [`--- a/${path}`, `+++ b/${path}`]
  const hunk = [`@@ -1,${Math.max(1, beforeLines.length)} +1,${Math.max(1, afterLines.length)} @@`]
  const removed = beforeLines.map((l) => `-${l}`)
  const added = afterLines.map((l) => `+${l}`)
  return [...header, ...hunk, ...removed, ...added].join('\n')
}

export default function ToolCallChangePopup({
  toolCall,
  result,
  resultType,
  durationMs,
}: {
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
  durationMs?: number
}) {
  const name = toolCall?.name || 'tool'
  const { projectId } = useActiveProject()
  const { storiesById, featuresById } = useStories()

  function errorContentOnly(): React.ReactNode {
    const msg = tryString(
      extract(result, ['error.message']) ||
        extract(result, ['message']) ||
        extract(result, ['error']),
    )
    const label =
      resultType === 'errored'
        ? 'Tool failed'
        : resultType === 'aborted'
          ? 'Tool aborted'
          : 'Tool status'
    return (
      <div className="text-[11px] rounded border border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300 px-2 py-1">
        <span className="font-semibold mr-1">{label}.</span>
        {msg ? <span className="font-mono">{msg}</span> : null}
      </div>
    )
  }

  // Pre-compute values for write_file so we can synthesize a diff if missing
  const args = toolCall?.arguments || {}
  const toolName = String(name)
  const writeFilePath: string | undefined =
    tryString(
      extract(args, ['path']) ||
        extract(args, ['name']) ||
        extract(args, ['relPath']) ||
        extract(result, ['path']),
    ) || undefined
  const writeFileNewText: string | undefined =
    tryString(
      extract(result, ['after.content', 'newContent', 'content']) ||
        extract(args, ['content']) ||
        extract(args, ['text']) ||
        extract(args, ['data']),
    ) || undefined
  const writeFileResultDiff = buildUnifiedDiffIfPresent(result)
  const [computedDiff, setComputedDiff] = useState<string | undefined>(undefined)
  const [computedIsNewFile, setComputedIsNewFile] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (toolName !== 'writeFile') return
      if (writeFileResultDiff) {
        setComputedDiff(undefined)
        setComputedIsNewFile(false)
        return
      }
      if (!writeFilePath || !writeFileNewText) return
      try {
        const beforeText = projectId
          ? await filesService.readFile(projectId, writeFilePath, 'utf8')
          : undefined
        if (cancelled) return
        setComputedIsNewFile(!beforeText)
        const diff = buildSimpleUnifiedDiff(writeFilePath, beforeText, writeFileNewText)
        setComputedDiff(diff)
      } catch {
        // ignore errors reading file
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [toolName, writeFilePath, writeFileNewText, writeFileResultDiff, projectId])

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
    if (n === 'renamePath') {
      const srcPath = tryString(extract(args, ['src'])) || tryString(extract(result, ['src']))
      const dstPath = tryString(extract(args, ['dst'])) || tryString(extract(result, ['dst']))
      return (
        <div className="text-xs">
          <span className="text-[var(--text-secondary)]">Path:</span>{' '}
          {srcPath ? (
            <span className="font-mono text-[11px] line-through text-red-600/80 mr-1">
              {srcPath}
            </span>
          ) : null}
          {srcPath ? <span className="mx-1">→</span> : null}
          {dstPath ? (
            <span className="font-mono text-[11px] font-semibold text-green-600 dark:text-green-400">
              {dstPath}
            </span>
          ) : null}
        </div>
      )
    }

    if (n === 'updateStoryTitle') {
      const oldVal = result ? undefined : storiesById[args.storyId]?.title
      const newVal = tryString(extract(args, ['title']))
      return <InlineOldNew oldVal={oldVal} newVal={newVal} />
    }
    if (n === 'updateFeatureTitle') {
      console.log('result: ', result)
      const oldVal = result ? undefined : featuresById[args.featureId]?.title
      const newVal = tryString(extract(args, ['title']))
      return <InlineOldNew oldVal={oldVal} newVal={newVal} />
    }

    if (n === 'updateStoryDescription' || n === 'updateFeatureDescription') {
      const oldDesc = result
        ? undefined
        : n === 'updateFeatureDescription'
          ? featuresById[args.featureId]?.description
          : storiesById[args.storyId]?.description
      const newDesc = tryString(extract(args, ['description']))
      const diff = undefined //TODO: make diff work well then use only it
      // oldDesc && newDesc ? buildSimpleUnifiedDiff('feature', oldDesc, newDesc) : undefined
      return (
        <div className="text-xs">
          {diff ? (
            <Code language="diff" code={diff} />
          ) : oldDesc && newDesc ? (
            <div>
              <SectionTitle>Updated description</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-[var(--text-secondary)] mb-1">Before</div>
                  <Code language="text" code={oldDesc} />
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-secondary)] mb-1">After</div>
                  <Code language="text" code={newDesc} />
                </div>
              </div>
            </div>
          ) : (
            <NewContentOnly text={newDesc} />
          )}
        </div>
      )
    }

    if (n === 'writeFile' || n === 'writeDiffToFile') {
      const path = writeFilePath
      const diff = writeFileResultDiff || computedDiff
      const newText = writeFileNewText
      const isNew = isCompletelyNewFile(result, writeFileResultDiff) || computedIsNewFile
      return (
        <div className="space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Path:</span>{' '}
            <span className="font-mono text-[11px]">{path || '(unknown)'}</span>
          </Row>
          {isNew ? (
            <NewContentOnly text={newText} label="File completely new." />
          ) : diff ? (
            <div>
              <StructuredUnifiedDiff patch={diff} />
            </div>
          ) : (
            <NewContentOnly text={newText} />
          )}
        </div>
      )
    }

    if (n === 'deletePath') {
      const delPath = tryString(extract(args, ['path']) || extract(result, ['path']))
      // If a result is present, show it (commonly indicates not found or a message)
      const resStr = (() => {
        if (result == null) return undefined
        try {
          return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        } catch {
          return String(result)
        }
      })()
      return (
        <div className="text-xs space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Path:</span>{' '}
            <span className="font-mono text-[11px]">{delPath || '(unknown)'}</span>
          </Row>
          {resStr ? (
            <div>
              <SectionTitle>Result</SectionTitle>
              <Code language="text" code={resStr} />
            </div>
          ) : null}
        </div>
      )
    }

    if (n === 'createFeature' || n === 'createStory') {
      const title = tryString(extract(args, ['title']))
      const description = tryString(extract(args, ['description']))
      return (
        <div>
          {title ? (
            <div className="mt-1">
              <SectionTitle>Title</SectionTitle>
              <span className="font-semibold">{title}</span>
            </div>
          ) : null}
          {description ? (
            <div className="mt-1">
              <SectionTitle>Description</SectionTitle>
              <Code language="text" code={description} />
            </div>
          ) : null}
        </div>
      )
    }

    if (n === 'finishFeature') {
      // Show only a concise FeatureSummaryCard and nothing else
      const feature = extract(result, ['feature']) || result
      if (feature && typeof feature === 'object') {
        return <FeatureSummaryCard feature={feature} />
      }
      return (
        <div className="text-xs text-[var(--text-secondary)]">No feature details available.</div>
      )
    }

    if (n === 'reorderFeature' || n === 'reorderStory') {
      const order = (extract(result, ['order']) ||
        extract(result, ['features']) ||
        extract(result, ['stories']) ||
        extract(args, ['order'])) as any[] | undefined
      const movedId = tryString(extract(args, ['movedId']) || extract(result, ['movedId']))
      if (order && Array.isArray(order) && order.length > 0) {
        return <ReorderList items={order} movedId={movedId} />
      }
      return <div className="text-xs text-[var(--text-secondary)]">Final order unavailable.</div>
    }

    if (n === 'searchFiles') {
      const query = tryString(extract(args, ['query']) || extract(result, ['query'])) || ''
      const resultsRaw =
        extract(result, ['results']) ||
        extract(result, ['matches']) ||
        extract(result, ['files']) ||
        extract(result, ['items']) ||
        extract(result, ['result']) ||
        result

      let resultLines: string[] = []
      if (Array.isArray(resultsRaw)) {
        resultLines = resultsRaw.map((it: any) => {
          const path = tryString(extract(it, ['path', 'file', 'filepath', 'name']))
          const line = tryString(extract(it, ['line', 'lineNumber']))
          const preview = tryString(extract(it, ['preview', 'text', 'content', 'match']))
          if (path || line || preview) {
            return [path, line ? `:${line}` : '', preview ? `: ${preview}` : ''].join('')
          }
          try {
            return typeof it === 'string' ? it : JSON.stringify(it)
          } catch {
            return String(it)
          }
        })
      } else if (typeof resultsRaw === 'string') {
        resultLines = resultsRaw.split(/\r?\n/)
      } else if (resultsRaw && typeof resultsRaw === 'object') {
        resultLines = toLines(resultsRaw)
      }

      const qLines = query.split(/\r?\n/)

      return (
        <div className="text-xs space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Query:</span>
          </Row>
          <PreLimited lines={qLines} maxLines={2} />
          {resultLines.length > 0 ? (
            <div>
              <SectionTitle>Results</SectionTitle>
              <PreLimited
                lines={resultLines}
                maxLines={10}
                renderTruncationMessage={(omitted) => <>+ {omitted} more</>}
              />
            </div>
          ) : (
            <div className="text-[11px] text-[var(--text-secondary)]">No results</div>
          )}
        </div>
      )
    }

    if (n === 'runTests' || n === 'runAllTests') {
      const stats = extract(result, ['summary']) || {}
      const passed = extract(stats, ['passed']) || 0
      const failed = extract(stats, ['failed']) || 0
      const skipped = extract(stats, ['skipped']) || 0
      const total = extract(stats, ['total']) || 0
      const duration = extract(stats, ['durationMs']) || 0

      const testFiles: string[] = extract(args, ['paths']) ?? []

      return (
        <div className="text-xs space-y-1">
          {testFiles.map((testFile, i) => (
            <Row key={testFile || i}>
              <span className="font-mono text-[11px]">{testFile || '(unknown)'}</span>
            </Row>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-green-700 dark:text-green-300 font-medium">
              {Number(passed)} passed
            </span>
            <span className="text-red-700 dark:text-red-300 font-medium">
              {Number(failed)} failed
            </span>
            {typeof skipped === 'number' ? (
              <span className="text-neutral-600 dark:text-neutral-400">
                {Number(skipped)} skipped
              </span>
            ) : null}
            {typeof total === 'number' ? (
              <span className="text-neutral-600 dark:text-neutral-400">{Number(total)} total</span>
            ) : null}
            {duration ? (
              <span className="text-neutral-600 dark:text-neutral-400">{Number(duration)}ms</span>
            ) : null}
          </div>
        </div>
      )
    }

    const str = (() => {
      try {
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      } catch {
        return String(result)
      }
    })()
    return (
      <div className="max-w-[420px] max-h-60 overflow-auto">
        <Code language="json" code={str || '(no result)'} />
      </div>
    )
  }, [
    name,
    toolCall?.arguments,
    result,
    resultType,
    writeFilePath,
    writeFileNewText,
    writeFileResultDiff,
    computedDiff,
    computedIsNewFile,
  ])

  return (
    <div className="min-w-[260px] max-w-[42vw] max-h-[48vh] overflow-auto">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon resultType={resultType} />
          <div className="truncate text-xs font-semibold">{name}</div>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
          {durationMs ? <span className="mr-2">{durationMs}ms</span> : null}
        </div>
      </div>
      <div className="border-t border-[var(--border-subtle)] pt-1">{content}</div>
    </div>
  )
}
