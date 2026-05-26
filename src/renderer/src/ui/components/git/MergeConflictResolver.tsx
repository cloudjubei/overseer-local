import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActiveProject } from 'thefactory-ui/headless'
import { useGit } from '@core/contexts/GitContext'
import {
  readFile as readFileSdk,
  writeFile as writeFileSdk,
} from 'thefactory-ui/headless/api'
import type { GitConflictEntry } from 'thefactory-ui/headless/api'
import { Alert, Button, Modal, Spinner } from 'thefactory-ui/web'

export type MergeConflictResolverProps = {
  isOpen: boolean
  onClose: () => void
  baseRef: string
  branch: string
  conflicts: GitConflictEntry[]
}

type SegmentText = { type: 'text'; text: string }
type SegmentConflict = {
  type: 'conflict'
  oursLabel: string
  theirsLabel: string
  ours: string
  theirs: string
}
type Segment = SegmentText | SegmentConflict

function hasConflictMarkers(s: string): boolean {
  return /<<<<<<< |>>>>>>> |=======/.test(s)
}

function parseConflictSegments(raw: string): Segment[] {
  const text = (raw || '').replace(/\r\n/g, '\n')
  const segments: Segment[] = []
  let i = 0
  while (i < text.length) {
    const startIdx = text.indexOf('<<<<<<< ', i)
    if (startIdx === -1) {
      segments.push({ type: 'text', text: text.slice(i) })
      break
    }
    if (startIdx > i) segments.push({ type: 'text', text: text.slice(i, startIdx) })

    const lineEnd = text.indexOf('\n', startIdx)
    const oursHeader = text.slice(
      startIdx + '<<<<<<< '.length,
      lineEnd === -1 ? text.length : lineEnd,
    )

    const sepNeedle = '\n=======\n'
    const sepIdx = text.indexOf(sepNeedle, lineEnd === -1 ? startIdx : lineEnd + 1)
    if (sepIdx === -1) {
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }

    const oursContent = text.slice(lineEnd === -1 ? startIdx : lineEnd + 1, sepIdx)
    const endMarker = '\n>>>>>>>'
    const endIdx = text.indexOf(endMarker, sepIdx + sepNeedle.length)
    if (endIdx === -1) {
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }
    const theirsHeaderLineEnd = text.indexOf('\n', endIdx + endMarker.length)
    const theirsHeader = text.slice(
      endIdx + endMarker.length + 1,
      theirsHeaderLineEnd === -1 ? text.length : theirsHeaderLineEnd,
    )
    const theirsContent = text.slice(sepIdx + sepNeedle.length, endIdx)

    segments.push({
      type: 'conflict',
      oursLabel: oursHeader || 'ours',
      theirsLabel: theirsHeader || 'theirs',
      ours: oursContent,
      theirs: theirsContent,
    })
    i = theirsHeaderLineEnd === -1 ? text.length : theirsHeaderLineEnd + 1
  }
  return segments
}

function joinSegments(segments: Segment[]): string {
  return segments
    .map((seg) =>
      seg.type === 'text'
        ? seg.text
        : `<<<<<<< ${seg.oursLabel}\n${seg.ours}\n=======\n${seg.theirs}\n>>>>>>> ${seg.theirsLabel}\n`,
    )
    .join('')
}

type BothOrder = 'ours-then-theirs' | 'theirs-then-ours'

/**
 * Visual side-by-side editor for merging the conflict markers git wrote into
 * the working tree. Trimmed port of desktop's `MergeConflictResolver`:
 * keeps the per-hunk ours/theirs/both choices, per-file actions, manual
 * edit, save-and-stage, abort-merge, and finalize commit. Drops encoding /
 * EOL detection, mtime polling, and the desktop-only external-tool button.
 */
export default function MergeConflictResolver({
  isOpen,
  onClose,
  baseRef,
  branch,
  conflicts,
}: MergeConflictResolverProps) {
  const { projectId } = useActiveProject()
  const { stage, commit, push, resetAll, getFileContent } = useGit()

  const [selected, setSelected] = useState<string | null>(conflicts[0]?.path || null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [segments, setSegments] = useState<Segment[]>([])
  const [dirty, setDirty] = useState(false)

  const [oursText, setOursText] = useState<string>('')
  const [theirsText, setTheirsText] = useState<string>('')
  const [triplesLoading, setTriplesLoading] = useState(false)

  const [resolvedMap, setResolvedMap] = useState<Record<string, boolean>>({})
  const [bothOrder, setBothOrder] = useState<BothOrder>('ours-then-theirs')
  const [showContextPanes, setShowContextPanes] = useState(true)
  const [wrapLines, setWrapLines] = useState(true)

  const [aborting, setAborting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeMsg, setFinalizeMsg] = useState<string>(`Merge branch ${branch}`)
  const [pushImmediately, setPushImmediately] = useState(false)

  const originalByPathRef = useRef<Record<string, string>>({})

  const isBinary = useMemo(() => {
    const c = conflicts.find((c) => c.path === selected)
    return c?.type ? /binary/i.test(String(c.type)) : false
  }, [conflicts, selected])

  const unresolvedCount = useMemo(
    () => segments.filter((s) => s.type === 'conflict').length,
    [segments],
  )
  const totalFiles = conflicts.length
  const resolvedCount = useMemo(
    () => Object.values(resolvedMap).filter(Boolean).length,
    [resolvedMap],
  )
  const allResolved = totalFiles > 0 && resolvedCount === totalFiles

  const loadFile = useCallback(
    async (path: string | null) => {
      if (!path || !projectId) return
      setLoading(true)
      setError(null)
      try {
        const { data } = await readFileSdk({
          path: { projectId },
          body: { path },
          throwOnError: true,
        })
        const raw = data.content ?? ''
        setContent(raw)
        setSegments(parseConflictSegments(raw))
        if (!originalByPathRef.current[path]) originalByPathRef.current[path] = raw
        setDirty(false)
        setResolvedMap((prev) => ({ ...prev, [path]: !hasConflictMarkers(raw) }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read file')
        setContent('')
        setSegments([])
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  const loadTriples = useCallback(
    async (path: string | null, base: string, incoming: string) => {
      if (!path || !projectId) return
      setTriplesLoading(true)
      try {
        const [ours, theirs] = await Promise.all([
          getFileContent(path, base).catch(() => ''),
          getFileContent(path, incoming).catch(() => ''),
        ])
        setOursText(ours)
        setTheirsText(theirs)
      } finally {
        setTriplesLoading(false)
      }
    },
    [projectId, getFileContent],
  )

  // Reset state whenever the modal reopens with a new conflict set.
  useEffect(() => {
    if (!isOpen) return
    setSelected(conflicts[0]?.path || null)
    originalByPathRef.current = {}
    setResolvedMap({})
    setError(null)
    setDirty(false)
  }, [isOpen, conflicts])

  useEffect(() => {
    if (isOpen) void loadFile(selected)
  }, [isOpen, selected, loadFile])

  useEffect(() => {
    if (isOpen && selected) void loadTriples(selected, baseRef, branch)
  }, [isOpen, selected, baseRef, branch, loadTriples])

  const applyChoice = (index: number, choice: 'ours' | 'theirs' | 'both') => {
    setSegments((prev) => {
      const next = [...prev]
      const seg = next[index]
      if (!seg || seg.type !== 'conflict') return prev
      let replacement = ''
      if (choice === 'ours') replacement = seg.ours
      else if (choice === 'theirs') replacement = seg.theirs
      else {
        const first = bothOrder === 'ours-then-theirs' ? seg.ours : seg.theirs
        const second = bothOrder === 'ours-then-theirs' ? seg.theirs : seg.ours
        replacement = first + (first && second ? '\n' : '') + second
      }
      next.splice(index, 1, { type: 'text', text: replacement })
      const joined = joinSegments(next)
      setDirty(true)
      setContent(joined)
      return next
    })
  }

  const applyChoiceAll = (choice: 'ours' | 'theirs' | 'both') => {
    setSegments((prev) => {
      const next: Segment[] = prev.map((seg) => {
        if (seg.type !== 'conflict') return seg
        if (choice === 'ours') return { type: 'text', text: seg.ours }
        if (choice === 'theirs') return { type: 'text', text: seg.theirs }
        const first = bothOrder === 'ours-then-theirs' ? seg.ours : seg.theirs
        const second = bothOrder === 'ours-then-theirs' ? seg.theirs : seg.ours
        return { type: 'text', text: first + (first && second ? '\n' : '') + second }
      })
      const joined = joinSegments(next)
      setDirty(true)
      setContent(joined)
      return next
    })
  }

  const acceptFile = (side: 'ours' | 'theirs') => {
    const txt = side === 'ours' ? oursText : theirsText
    setContent(txt)
    setSegments(parseConflictSegments(txt))
    setDirty(true)
  }

  const resetFileToOriginal = () => {
    if (!selected) return
    const orig = originalByPathRef.current[selected]
    if (typeof orig !== 'string') return
    setContent(orig)
    setSegments(parseConflictSegments(orig))
    setDirty(true)
  }

  const onSave = async () => {
    if (!selected || !projectId) return
    setSaving(true)
    setError(null)
    try {
      await writeFileSdk({
        path: { projectId },
        body: { path: selected, content },
        throwOnError: true,
      })
      try {
        await stage([selected])
      } catch {
        // Stage failures don't block — user can stage manually after save.
      }
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [selected]: !hasConflictMarkers(content) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  const doAbort = async () => {
    if (aborting) return
    setAborting(true)
    setError(null)
    try {
      await resetAll()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort merge')
    } finally {
      setAborting(false)
    }
  }

  const doFinalize = async () => {
    if (finalizing) return
    setFinalizing(true)
    setError(null)
    try {
      try {
        await stage(conflicts.map((c) => c.path))
      } catch {
        // Best-effort; if a file is missing, commit will fail loudly.
      }
      const message = finalizeMsg.trim() || `Merge branch ${branch}`
      await commit({ message })
      if (pushImmediately) {
        try {
          await push()
        } catch (pushErr) {
          setError(pushErr instanceof Error ? pushErr.message : 'Push failed')
          return
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize merge')
    } finally {
      setFinalizing(false)
    }
  }

  const currentConflict = conflicts.find((c) => c.path === selected)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resolve merge conflicts" size="xl">
      <div className="flex flex-col gap-3 min-h-[480px]">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-end gap-3 text-xs">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={showContextPanes}
              onChange={(e) => setShowContextPanes(e.target.checked)}
            />
            <span>Context panes</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={wrapLines}
              onChange={(e) => setWrapLines(e.target.checked)}
            />
            <span>Wrap</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <span>Both order</span>
            <select
              className="border border-(--border-subtle) bg-transparent rounded px-1 py-0.5"
              value={bothOrder}
              onChange={(e) => setBothOrder(e.target.value as BothOrder)}
            >
              <option value="ours-then-theirs">ours → theirs</option>
              <option value="theirs-then-ours">theirs → ours</option>
            </select>
          </label>
        </div>

        <div className="flex gap-3 min-h-[420px]">
          <div className="w-64 shrink-0 border border-(--border-subtle) rounded-md flex flex-col overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-(--surface-muted)">
              Conflicted files
            </div>
            <div className="flex-1 overflow-auto divide-y divide-(--border-subtle)">
              {conflicts.map((c) => {
                const isSel = c.path === selected
                const isResolved = resolvedMap[c.path]
                return (
                  <button
                    key={c.path}
                    type="button"
                    className={`w-full text-left px-3 py-2 ${
                      isSel ? 'bg-(--surface-muted)' : 'hover:bg-(--surface-muted)'
                    }`}
                    onClick={() => setSelected(c.path)}
                    title={c.path}
                  >
                    <div className="truncate font-mono text-xs">{c.path}</div>
                    <div className="text-[11px] opacity-60">
                      {isResolved ? 'Resolved' : 'Unresolved'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-w-0 border border-(--border-subtle) rounded-md flex flex-col overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-(--border-subtle)">
              <div className="text-sm">
                {selected ? <span className="font-mono">{selected}</span> : 'Select a file'}
                {selected && (
                  <span className="ml-2 text-xs opacity-70">
                    {hasConflictMarkers(content)
                      ? `${unresolvedCount} conflict${unresolvedCount === 1 ? '' : 's'} remaining`
                      : 'No conflicts detected'}
                  </span>
                )}
              </div>
              <Button
                onClick={() => void onSave()}
                loading={saving}
                disabled={!dirty || saving || !selected}
                size="sm"
              >
                Save &amp; Stage
              </Button>
            </div>

            {!selected ? (
              <div className="p-4 text-sm opacity-70">Select a conflicted file to resolve.</div>
            ) : loading ? (
              <div className="p-4 text-sm opacity-70 flex items-center gap-2">
                <Spinner /> Loading file…
              </div>
            ) : isBinary ? (
              <div className="p-4 text-sm flex flex-col gap-3">
                <p className="opacity-70">Binary conflict — pick a side from one of the parents.</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => acceptFile('ours')}>
                    Accept ours
                  </Button>
                  <Button size="sm" onClick={() => acceptFile('theirs')}>
                    Accept theirs
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void onSave()}>
                    Save &amp; Stage
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-3">
                <div
                  className={`grid grid-cols-1 ${
                    showContextPanes ? 'lg:grid-cols-3' : 'lg:grid-cols-1'
                  } gap-3`}
                >
                  {showContextPanes && (
                    <div className="min-w-0">
                      <div className="text-xs opacity-70 mb-1">Theirs (incoming)</div>
                      {triplesLoading ? (
                        <div className="text-xs opacity-70">
                          <Spinner />
                        </div>
                      ) : (
                        <pre
                          className={`text-xs font-mono ${
                            wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                          } max-h-64 overflow-auto border border-(--border-subtle) rounded-md p-2`}
                        >
                          <code>{theirsText.replace(/\r\n/g, '\n')}</code>
                        </pre>
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs opacity-70 mb-1">Result (editable)</div>
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value)
                        setSegments(parseConflictSegments(e.target.value))
                        setDirty(true)
                      }}
                      className={`w-full h-56 lg:h-full min-h-[224px] font-mono text-xs rounded-md border border-(--border-subtle) bg-transparent p-2 resize-vertical ${
                        wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'
                      }`}
                      spellCheck={false}
                    />
                  </div>
                  {showContextPanes && (
                    <div className="min-w-0">
                      <div className="text-xs opacity-70 mb-1">Ours (current)</div>
                      {triplesLoading ? (
                        <div className="text-xs opacity-70">
                          <Spinner />
                        </div>
                      ) : (
                        <pre
                          className={`text-xs font-mono ${
                            wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                          } max-h-64 overflow-auto border border-(--border-subtle) rounded-md p-2`}
                        >
                          <code>{oursText.replace(/\r\n/g, '\n')}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {segments.some((s) => s.type === 'conflict') && (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => applyChoiceAll('ours')}>
                      Accept ours (all)
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => applyChoiceAll('theirs')}>
                      Accept theirs (all)
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => applyChoiceAll('both')}>
                      Accept both (all)
                    </Button>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => acceptFile('ours')}>
                        Accept ours (file)
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => acceptFile('theirs')}>
                        Accept theirs (file)
                      </Button>
                      <Button variant="ghost" size="sm" onClick={resetFileToOriginal}>
                        Reset file
                      </Button>
                    </div>
                  </div>
                )}

                {segments.map((seg, idx) => {
                  if (seg.type === 'text') {
                    if (!seg.text.trim()) return null
                    return (
                      <div
                        key={idx}
                        className="border border-(--border-subtle) rounded-md overflow-hidden"
                      >
                        <pre
                          className={`text-xs font-mono ${
                            wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                          } max-h-64 overflow-auto p-2`}
                        >
                          <code>{seg.text.replace(/\r\n/g, '\n')}</code>
                        </pre>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={idx}
                      className="border border-amber-300/60 dark:border-amber-600/40 rounded-md overflow-hidden"
                    >
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        Conflict
                      </div>
                      <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs opacity-70 mb-1">
                            Ours: <span className="font-mono">{seg.oursLabel}</span>
                          </div>
                          <pre
                            className={`text-xs font-mono ${
                              wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                            } max-h-64 overflow-auto border border-(--border-subtle) rounded-md p-2`}
                          >
                            <code>{seg.ours.replace(/\r\n/g, '\n')}</code>
                          </pre>
                          <div className="mt-2">
                            <Button size="sm" onClick={() => applyChoice(idx, 'ours')}>
                              Accept ours
                            </Button>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs opacity-70 mb-1">
                            Theirs: <span className="font-mono">{seg.theirsLabel}</span>
                          </div>
                          <pre
                            className={`text-xs font-mono ${
                              wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
                            } max-h-64 overflow-auto border border-(--border-subtle) rounded-md p-2`}
                          >
                            <code>{seg.theirs.replace(/\r\n/g, '\n')}</code>
                          </pre>
                          <div className="mt-2">
                            <Button size="sm" onClick={() => applyChoice(idx, 'theirs')}>
                              Accept theirs
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 pb-3">
                        <Button variant="ghost" size="sm" onClick={() => applyChoice(idx, 'both')}>
                          Accept both
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-(--border-subtle) pt-2">
          <div className="text-xs opacity-70">
            {resolvedCount}/{totalFiles} files resolved
            {currentConflict ? '' : ''}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void doAbort()} loading={aborting}>
              Abort merge
            </Button>
            <input
              type="text"
              value={finalizeMsg}
              onChange={(e) => setFinalizeMsg(e.target.value)}
              className="px-2 py-1 text-xs rounded border border-(--border-subtle) bg-transparent"
              placeholder={`Merge branch ${branch}`}
            />
            <label className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={pushImmediately}
                onChange={(e) => setPushImmediately(e.target.checked)}
              />
              <span>Push</span>
            </label>
            <Button
              onClick={() => void doFinalize()}
              disabled={!allResolved || finalizing}
              loading={finalizing}
            >
              Finalize merge
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
