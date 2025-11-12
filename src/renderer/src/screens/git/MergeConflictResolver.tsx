import React from 'react'
import { filesService } from '@renderer/services/filesService'
import { Button } from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { GitConflictEntry } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'
import { notificationsService } from '@renderer/services/notificationsService'
import { factoryToolsService } from '@renderer/services/factoryToolsService'

export type MergeConflictResolverProps = {
  projectId: string
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
    const oursHeader = text.slice(startIdx + '<<<<<<< '.length, lineEnd === -1 ? text.length : lineEnd)

    const sepNeedle = '\n=======\n'
    const sepIdx = text.indexOf(sepNeedle, lineEnd === -1 ? startIdx : lineEnd + 1)
    if (sepIdx === -1) {
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }

    const oursContent = text.slice((lineEnd === -1 ? startIdx : lineEnd + 1), sepIdx)
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
    i = (theirsHeaderLineEnd === -1 ? text.length : theirsHeaderLineEnd + 1)
  }
  return segments
}

function joinSegments(segments: Segment[]): string {
  return segments
    .map((seg) => (seg.type === 'text' ? seg.text : `<<<<<<< ${seg.oursLabel}\n${seg.ours}\n=======\n${seg.theirs}\n>>>>>>> ${seg.theirsLabel}\n`))
    .join('')
}

export default function MergeConflictResolver({ projectId, baseRef, branch, conflicts }: MergeConflictResolverProps) {
  const [selected, setSelected] = React.useState<string | null>(conflicts[0]?.path || null)

  // Editor states
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>('')
  const [segments, setSegments] = React.useState<Segment[]>([])
  const [dirty, setDirty] = React.useState(false)

  // Triples for 3-pane context
  const [oursText, setOursText] = React.useState<string>('')
  const [theirsText, setTheirsText] = React.useState<string>('')
  const [triplesLoading, setTriplesLoading] = React.useState<boolean>(false)

  // UI toggles
  const [showContextPanes, setShowContextPanes] = React.useState<boolean>(true)
  const [wrapLines, setWrapLines] = React.useState<boolean>(true)
  const [syncScroll, setSyncScroll] = React.useState<boolean>(false)
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState<boolean>(false)

  // Preferences (persisted per project): default order for 'pick both'; wrap and whitespace
  type BothOrder = 'ours-then-theirs' | 'theirs-then-ours'
  const LS_PREFIX = 'git.conflict.prefs:'
  const lsKey = `${LS_PREFIX}${projectId}`
  const [bothOrder, setBothOrder] = React.useState<BothOrder>(() => {
    try {
      const raw = localStorage.getItem(lsKey)
      if (!raw) return 'ours-then-theirs'
      const parsed = JSON.parse(raw)
      return (parsed?.bothOrder as BothOrder) || 'ours-then-theirs'
    } catch {
      return 'ours-then-theirs'
    }
  })
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey)
      const prev = raw ? JSON.parse(raw) : {}
      const next = { ...prev, bothOrder, wrapLines, ignoreWhitespace }
      localStorage.setItem(lsKey, JSON.stringify(next))
    } catch {}
  }, [bothOrder, wrapLines, ignoreWhitespace])

  // Sidebar/search and session controls
  const [search, setSearch] = React.useState<string>('')
  const [abortRunning, setAbortRunning] = React.useState<boolean>(false)
  const [finalizing, setFinalizing] = React.useState<boolean>(false)
  const [finalizeMsg, setFinalizeMsg] = React.useState<string>(() => `Merge branch ${branch}`)
  const [pushImmediately, setPushImmediately] = React.useState<boolean>(false)

  // Track original conflicted content for reset
  const originalByPathRef = React.useRef<Record<string, string>>({})
  const originalEolByPathRef = React.useRef<Record<string, '\n' | '\r\n' | 'mixed'>>({})
  const originalEncodingByPathRef = React.useRef<Record<string, string>>({})
  const [normalizeEol, setNormalizeEol] = React.useState<boolean>(false)
  const [encodingWarning, setEncodingWarning] = React.useState<string | null>(null)
  const [eolWarning, setEolWarning] = React.useState<string | null>(null)

  // Track resolved map to compute x/y resolved
  const [resolvedMap, setResolvedMap] = React.useState<Record<string, boolean>>({})
  const totalFiles = conflicts.length
  const resolvedCount = React.useMemo(() => Object.values(resolvedMap).filter(Boolean).length, [resolvedMap])
  const allResolved = totalFiles > 0 && resolvedCount === totalFiles

  const currentConflict = conflicts.find((c) => c.path === selected) || null
  const isBinary = currentConflict?.type && /binary/i.test(String(currentConflict?.type || ''))
  const unresolvedCount = React.useMemo(() => segments.filter((s) => s.type === 'conflict').length, [segments])
  const isVeryLarge = React.useMemo(() => (content?.length || 0) > 200000 || segments.length > 800, [content, segments.length])

  // Concurrency tracking (detect external edits with mtime)
  const [mtimeMap, setMtimeMap] = React.useState<Record<string, number>>({})
  const [externalChanged, setExternalChanged] = React.useState<boolean>(false)
  const pollRef = React.useRef<number | null>(null)

  const loadTriples = React.useCallback(async (path: string | null, base: string, incoming: string) => {
    if (!path) return
    try {
      setTriplesLoading(true)
      const [ours, theirs] = await Promise.all([
        gitService.getFileContent(projectId, path, base),
        gitService.getFileContent(projectId, path, incoming),
      ])
      setOursText(ours || '')
      setTheirsText(theirs || '')
    } catch {
      setOursText('')
      setTheirsText('')
    } finally {
      setTriplesLoading(false)
    }
  }, [projectId])

  const loadFile = React.useCallback(async (path: string | null) => {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      // Read as utf8 (renderer surface supports encoding hint only)
      const raw = await filesService.readFile(projectId, path, 'utf8')
      const data = raw ?? ''
      // Detect EOL and encoding heuristics (warn only)
      const hasCRLF = /\r\n/.test(data)
      const hasLF = /(?<!\r)\n/.test(data)
      const eolType: '\\n' | '\\r\\n' | 'mixed' = hasCRLF && hasLF ? 'mixed' : hasCRLF ? '\r\n' : '\n'
      originalEolByPathRef.current[path] = eolType
      setEolWarning(eolType === 'mixed' ? 'File has mixed line endings. Consider normalizing.' : null)
      // Basic encoding hint: look for replacement char from bad decode
      const looksMojibake = /\uFFFD/.test(data)
      originalEncodingByPathRef.current[path] = looksMojibake ? 'unknown/non-utf8' : 'utf8'
      setEncodingWarning(looksMojibake ? 'File may have non-UTF-8 encoding. Saving as UTF-8 could alter bytes.' : null)

      setContent(data)
      setSegments(parseConflictSegments(data))
      if (!originalByPathRef.current[path]) originalByPathRef.current[path] = data
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [path]: !hasConflictMarkers(data) }))
      // Record mtime for concurrency
      try {
        const stats = await filesService.getAllFileStats(projectId)
        const rec = (stats && stats[path]) || (stats && stats['./' + path])
        const mtimeMs = typeof rec?.mtimeMs === 'number' ? rec.mtimeMs : undefined
        if (mtimeMs) setMtimeMap((prev) => ({ ...prev, [path!]: mtimeMs }))
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Failed to read file')
      setContent('')
      setSegments([])
      setResolvedMap((prev) => ({ ...prev, [path!]: false }))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const recomputeResolvedAll = React.useCallback(async () => {
    const map: Record<string, boolean> = {}
    for (const c of conflicts) {
      try {
        const txt = await filesService.readFile(projectId, c.path, 'utf8')
        map[c.path] = !hasConflictMarkers(String(txt || ''))
      } catch {
        map[c.path] = false
      }
    }
    setResolvedMap(map)
  }, [conflicts, projectId])

  React.useEffect(() => { void loadFile(selected) }, [selected, loadFile])
  React.useEffect(() => { if (selected) void loadTriples(selected, baseRef, branch) }, [selected, baseRef, branch, loadTriples])
  React.useEffect(() => { void recomputeResolvedAll() }, [recomputeResolvedAll])

  // Poll for external edits while modal is open (every 2s)
  React.useEffect(() => {
    const tick = async () => {
      try {
        const stats = await filesService.getAllFileStats(projectId)
        const next: Record<string, number> = { ...mtimeMap }
        let changed = false
        for (const c of conflicts) {
          const p = c.path
          const rec = (stats && stats[p]) || (stats && stats['./' + p])
          const mtimeMs = typeof rec?.mtimeMs === 'number' ? rec.mtimeMs : undefined
          if (!mtimeMs) continue
          const prev = mtimeMap[p]
          next[p] = mtimeMs
          if (prev && mtimeMs > prev + 10) {
            changed = true
          }
        }
        setMtimeMap(next)
        setExternalChanged(changed)
      } catch {}
    }
    const id = window.setInterval(() => { void tick() }, 2000)
    pollRef.current = id
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [projectId, conflicts, mtimeMap])

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

  const onManualEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)
    setSegments(parseConflictSegments(val))
    setDirty(true)
  }

  const onSave = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      // Apply EOL normalization if enabled; otherwise preserve original
      let out = content
      if (normalizeEol) {
        out = out.replace(/\r?\n/g, '\n')
      } else {
        const eol = originalEolByPathRef.current[selected]
        if (eol === '\\r\\n') out = out.replace(/(?<!\r)\n/g, '\r\n')
        // if mixed or \n, keep as-is
      }
      await filesService.writeFile(projectId, selected, out, 'utf8')
      try { await gitService.stage(projectId, [selected]) } catch {}
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [selected]: !hasConflictMarkers(content) }))
      // Telemetry: save action (non-PII)
      try { await notificationsService.create(projectId, { title: 'Conflict file saved', body: selected }) } catch {}
    } catch (e: any) {
      setError(e?.message || 'Failed to save file')
      try { await notificationsService.create(projectId, { title: 'Save failed', body: String(e?.message || e) }) } catch {}
    } finally {
      setSaving(false)
      try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
    }
  }

  const onRefresh = async () => {
    await loadFile(selected)
    if (selected) await loadTriples(selected, baseRef, branch)
  }

  const acceptFile = async (side: 'ours' | 'theirs') => {
    if (!selected) return
    const txt = side === 'ours' ? oursText : theirsText
    setContent(txt)
    setSegments(parseConflictSegments(txt))
    setDirty(true)
  }

  const resetFileToOriginal = async () => {
    if (!selected) return
    const orig = originalByPathRef.current[selected]
    if (typeof orig !== 'string') return
    try {
      await filesService.writeFile(projectId, selected, orig)
      setContent(orig)
      setSegments(parseConflictSegments(orig))
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [selected]: !hasConflictMarkers(orig) }))
    } catch (e: any) {
      setError(e?.message || 'Failed to reset file')
    }
  }

  // Keyboard shortcuts and hunk focus
  const conflictIdxList = React.useMemo(() => segments.map((s, i) => (s.type === 'conflict' ? i : -1)).filter((i) => i >= 0), [segments])
  const [focusedHunk, setFocusedHunk] = React.useState<number>(conflictIdxList[0] ?? -1)
  const segmentRefs = React.useRef<Record<number, HTMLDivElement | null>>({})
  React.useEffect(() => { setFocusedHunk(conflictIdxList[0] ?? -1) }, [selected])

  const scrollHunkIntoView = React.useCallback((idx: number) => {
    const el = segmentRefs.current[idx]
    if (el) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch {} }
  }, [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inText = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      if (!inText && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        if (conflictIdxList.length === 0) return
        const curPos = conflictIdxList.indexOf(focusedHunk)
        if (e.key === 'ArrowDown') {
          const next = conflictIdxList[Math.min(conflictIdxList.length - 1, Math.max(0, curPos) + 1)]
          if (typeof next === 'number') { setFocusedHunk(next); scrollHunkIntoView(next) }
        } else if (e.key === 'ArrowUp') {
          const prev = conflictIdxList[Math.max(0, curPos <= 0 ? 0 : curPos - 1)]
          if (typeof prev === 'number') { setFocusedHunk(prev); scrollHunkIntoView(prev) }
        }
        return
      }
      if (mod && !inText && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        const idx = focusedHunk >= 0 ? focusedHunk : (conflictIdxList[0] ?? -1)
        if (idx < 0) return
        if (e.key === '1') applyChoice(idx, 'ours')
        else if (e.key === '2') applyChoice(idx, 'theirs')
        else applyChoice(idx, 'both')
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void onSave()
        return
      }
      if (mod && (e.key === 'Enter')) {
        e.preventDefault()
        void doFinalize()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedHunk, conflictIdxList])

  const doFinalize = React.useCallback(async () => {
    if (finalizing) return
    setFinalizing(true)
    try {
      await recomputeResolvedAll()
      const unresolved = Object.entries(resolvedMap).filter(([_, v]) => !v).map(([k]) => k)
      if (unresolved.length > 0) {
        alert(`Cannot finalize: ${unresolved.length} file(s) still have unresolved markers.`)
        return
      }
      try { await gitService.stage(projectId, conflicts.map((c) => c.path)) } catch {}
      const message = finalizeMsg && finalizeMsg.trim().length > 0 ? finalizeMsg : `Merge branch ${branch}`
      const res = await gitService.commit(projectId, { message })
      if (!res?.ok) { alert(`Commit failed: ${res?.error || 'unknown error'}`); return }
      if (pushImmediately) {
        const p = await gitService.push(projectId, 'origin')
        if (!p?.ok) alert(`Push failed: ${p?.error || 'unknown error'}`)
      }
      try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
      // Telemetry (non-PII)
      try { await notificationsService.create(projectId, { title: 'Merge finalized', body: `${conflicts.length} file(s)` }) } catch {}
      alert('Merge finalized.')
    } catch (e) {
      console.error('Finalize merge failed', e)
      try { await notificationsService.create(projectId, { title: 'Finalize merge failed', body: '' + e }) } catch {}
      alert('Finalize merge failed')
    } finally {
      setFinalizing(false)
    }
  }, [finalizing, recomputeResolvedAll, resolvedMap, projectId, conflicts, finalizeMsg, branch, pushImmediately])

  // Sync scroll between panes
  const leftPaneRef = React.useRef<HTMLDivElement | null>(null)
  const rightPaneRef = React.useRef<HTMLDivElement | null>(null)
  const onSyncScroll = React.useCallback((src: 'left' | 'right') => {
    if (!syncScroll) return
    const a = src === 'left' ? leftPaneRef.current : rightPaneRef.current
    const b = src === 'left' ? rightPaneRef.current : leftPaneRef.current
    if (a && b) { b.scrollTop = a.scrollTop }
  }, [syncScroll])

  return (
    <div className='flex flex-col gap-3 min-h-[480px]'>
      {/* Top toolbar for toggles */}
      <div className='flex items-center justify-end gap-3 text-xs'>
        <label className='inline-flex items-center gap-1'>
          <input type='checkbox' checked={showContextPanes} onChange={(e) => setShowContextPanes(e.target.checked)} />
          <span>Show context panes</span>
        </label>
        <label className='inline-flex items-center gap-1'>
          <input type='checkbox' checked={wrapLines} onChange={(e) => setWrapLines(e.target.checked)} />
          <span>Wrap</span>
        </label>
        <label className='inline-flex items-center gap-1'>
          <input type='checkbox' checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.target.checked)} />
          <span>Ignore WS</span>
        </label>
        <label className='inline-flex items-center gap-1'>
          <span>Both order</span>
          <select
            aria-label='Default order for accept both'
            className='border border-neutral-200 dark:border-neutral-800 bg-transparent rounded px-1 py-0.5'
            value={bothOrder}
            onChange={(e) => setBothOrder(e.target.value as BothOrder)}
          >
            <option value='ours-then-theirs'>ours → theirs</option>
            <option value='theirs-then-ours'>theirs → ours</option>
          </select>
        </label>
        <label className='inline-flex items-center gap-1'>
          <input type='checkbox' checked={normalizeEol} onChange={(e) => setNormalizeEol(e.target.checked)} />
          <span>Normalize EOL</span>
        </label>
      </div>

      <div className='flex gap-3 min-h-[420px]'>
        {/* Sidebar */}
        <div className='w-64 shrink-0 border rounded-md border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden'>
          <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-neutral-50 dark:bg-neutral-900/40'>
            Conflicted files
          </div>
          <div className='p-2'>
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Filter files...'
              className='w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-800 bg-transparent'
            />
          </div>
          <div className='flex-1 overflow-auto text-sm divide-y divide-neutral-100 dark:divide-neutral-900'>
            {conflicts
              .filter((c) => !search || c.path.toLowerCase().includes(search.toLowerCase()))
              .map((c) => {
                const isSel = c.path === selected
                const statusCls = isSel ? 'bg-neutral-100 dark:bg-neutral-900/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30'
                const isResolved = resolvedMap[c.path]
                return (
                  <div
                    key={c.path}
                    className={`px-3 py-2 cursor-pointer ${statusCls} group`}
                    onClick={() => setSelected(c.path)}
                    title={c.path}
                    role='button'
                    aria-label={`Open ${c.path} for conflict resolution`}
                    aria-pressed={isSel}
                  >
                    <div className='truncate font-mono'>{c.path}</div>
                    <div className='text-[11px] text-neutral-500'>
                      {isResolved ? 'Resolved' : 'Unresolved'}
                    </div>
                    <div className='mt-1 hidden group-hover:flex items-center gap-1'>
                      <Button size='xs' variant='ghost' onClick={(e) => { e.stopPropagation(); void acceptFile('ours') }}>Accept ours</Button>
                      <Button size='xs' variant='ghost' onClick={(e) => { e.stopPropagation(); void acceptFile('theirs') }}>Accept theirs</Button>
                      <Button size='xs' variant='ghost' onClick={(e) => { e.stopPropagation(); void resetFileToOriginal() }}>Reset file</Button>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Main area */}
        <div className='flex-1 min-w-0 border rounded-md border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden'>
          <div className='px-3 py-2 flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-900'>
            <div className='text-sm'>
              {selected ? <span className='font-mono'>{selected}</span> : 'Select a file'}
              {selected && (
                <span className='ml-2 text-xs text-neutral-600 dark:text-neutral-400'>
                  {hasConflictMarkers(content) ? `${unresolvedCount} conflict${unresolvedCount === 1 ? '' : 's'} remaining` : 'No conflicts detected'}
                </span>
              )}
              {externalChanged && selected && (
                <span className='ml-2 text-xs text-amber-600 dark:text-amber-400'>External changes detected</span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <Tooltip content={'reload from disk'} placement='bottom'>
                <span>
                  <Button variant='ghost' size='sm' onClick={onRefresh} disabled={loading || saving}>
                    Refresh
                  </Button>
                </span>
              </Tooltip>
              <Tooltip content={'open in external merge tool'} placement='bottom'>
                <span>
                  <Button variant='ghost' size='sm' onClick={async () => {
                    try {
                      await factoryToolsService.executeTool(projectId, 'open-external-merge-tool', { file: selected })
                      await onRefresh()
                    } catch (e) {
                      console.warn('External tool open failed', e)
                    }
                  }}>
                    External tool…
                  </Button>
                </span>
              </Tooltip>
              <Tooltip content={'save & stage'} placement='bottom'>
                <span>
                  <Button onClick={onSave} loading={saving} disabled={!dirty || saving || !selected}>
                    Save & Stage
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>

          {!selected ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400'>Select a conflicted file to resolve.</div>
          ) : loading ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
              <Spinner size={14} label='Loading file...' />
            </div>
          ) : isBinary ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400'>
              Binary conflict. Use file-level actions (Accept ours/theirs) and Save & Stage.
              <div className='mt-2 flex items-center gap-2'>
                <Button size='sm' onClick={() => void acceptFile('ours')}>Accept ours</Button>
                <Button size='sm' onClick={() => void acceptFile('theirs')}>Accept theirs</Button>
                <Button size='sm' variant='secondary' onClick={() => void onSave()}>Save & Stage</Button>
              </div>
            </div>
          ) : isVeryLarge ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400'>
              Large file detected. For performance, hunk rendering is disabled. Use file-level actions below and Save & Stage.
              <div className='mt-2 flex items-center gap-2'>
                <Button size='sm' onClick={() => void acceptFile('ours')}>Accept ours (file)</Button>
                <Button size='sm' onClick={() => void acceptFile('theirs')}>Accept theirs (file)</Button>
                <Button size='sm' variant='secondary' onClick={() => void onSave()}>Save & Stage</Button>
              </div>
            </div>
          ) : (
            <div className='flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-3'>
              {error && (
                <div className='text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap'>{error}</div>
              )}
              {eolWarning && (
                <div className='text-xs text-amber-600 dark:text-amber-400'>{eolWarning}</div>
              )}
              {encodingWarning && (
                <div className='text-xs text-amber-600 dark:text-amber-400'>{encodingWarning}</div>
              )}

              {/* 3-pane context */}
              <div className={`grid grid-cols-1 ${showContextPanes ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-3`}>
                {showContextPanes && (
                  <div className='min-w-0'>
                    <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Theirs (incoming)</div>
                    {triplesLoading ? (
                      <div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={12} label='Loading...' /></div>
                    ) : (
                      <pre ref={leftPaneRef} onScroll={() => onSyncScroll('left')} className={`text-xs font-mono ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} max-h-64 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-md`}>
                        <code>{(theirsText || '').replace(/\r\n/g, '\n')}</code>
                      </pre>
                    )}
                  </div>
                )}
                <div className='min-w-0'>
                  <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Result (editable)</div>
                  <textarea
                    value={content}
                    onChange={onManualEditChange}
                    aria-label='Editable merge result content'
                    className={`w-full h-56 lg:h-full min-h-[224px] font-mono text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent p-2 resize-vertical ${wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
                    spellCheck={false}
                  />
                </div>
                {showContextPanes && (
                  <div className='min-w-0'>
                    <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Ours (current)</div>
                    {triplesLoading ? (
                      <div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={12} label='Loading...' /></div>
                    ) : (
                      <pre ref={rightPaneRef} onScroll={() => onSyncScroll('right')} className={`text-xs font-mono ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} max-h-64 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-md`}>
                        <code>{(oursText || '').replace(/\r\n/g, '\n')}</code>
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Per-hunk controls and segments */}
              {segments.some((s) => s.type === 'conflict') && (
                <div className='flex items-center gap-2'>
                  <Tooltip content={'accept all ours/current'} placement='bottom'>
                    <span>
                      <Button variant='secondary' size='sm' onClick={() => applyChoiceAll('ours')} aria-label='Accept all ours'>
                        Accept ours (all)
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip content={'accept all theirs/incoming'} placement='bottom'>
                    <span>
                      <Button variant='secondary' size='sm' onClick={() => applyChoiceAll('theirs')} aria-label='Accept all theirs'>
                        Accept theirs (all)
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip content={'concatenate both sides for all hunks'} placement='bottom'>
                    <span>
                      <Button variant='secondary' size='sm' onClick={() => applyChoiceAll('both')} aria-label='Accept both for all hunks'>
                        Accept both (all)
                      </Button>
                    </span>
                  </Tooltip>
                  <div className='ml-auto flex items-center gap-2'>
                    <Button variant='ghost' size='sm' onClick={() => void acceptFile('ours')}>Accept ours (file)</Button>
                    <Button variant='ghost' size='sm' onClick={() => void acceptFile('theirs')}>Accept theirs (file)</Button>
                    <Button variant='ghost' size='sm' onClick={() => void resetFileToOriginal()}>Reset file</Button>
                  </div>
                </div>
              )}

              {segments.map((seg, idx) => {
                if (seg.type === 'text') {
                  return (
                    <div key={idx} className='border rounded-md border-neutral-200 dark:border-neutral-800'>
                      <pre className={`text-xs font-mono ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} max-h-64 overflow-auto`}>
                        <code>{(seg.text || '').replace(/\r\n/g, '\n')}</code>
                      </pre>
                    </div>
                  )
                }
                return (
                  <div
                    key={idx}
                    ref={(el) => { segmentRefs.current[idx] = el }}
                    className={`border rounded-md border-amber-300/60 dark:border-amber-600/40 overflow-hidden ${focusedHunk === idx ? 'ring-2 ring-amber-400/60' : ''}`}
                    role='group'
                    aria-label={`Conflict hunk ${idx + 1}`}
                  >
                    <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'>
                      Conflict
                    </div>
                    <div className='p-2 grid grid-cols-1 md:grid-cols-2 gap-3'>
                      <div>
                        <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>
                          Ours: <span className='font-mono'>{seg.oursLabel || 'current'}</span>
                        </div>
                        <pre className={`text-xs font-mono ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} max-h-64 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-md`}>
                          <code>{(seg.ours || '').replace(/\r\n/g, '\n')}</code>
                        </pre>
                        <div className='mt-2'>
                          <Button size='sm' onClick={() => applyChoice(idx, 'ours')} aria-label={`Accept ours for hunk ${idx + 1}`}>Accept ours</Button>
                        </div>
                      </div>
                      <div>
                        <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>
                          Theirs: <span className='font-mono'>{seg.theirsLabel || 'incoming'}</span>
                        </div>
                        <pre className={`text-xs font-mono ${wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'} max-h-64 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-md`}>
                          <code>{(seg.theirs || '').replace(/\r\n/g, '\n')}</code>
                        </pre>
                        <div className='mt-2'>
                          <Button size='sm' onClick={() => applyChoice(idx, 'theirs')} aria-label={`Accept theirs for hunk ${idx + 1}`}>Accept theirs</Button>
                        </div>
                      </div>
                    </div>
                    <div className='px-3 pb-3'>
                      <Button variant='ghost' size='sm' onClick={() => applyChoice(idx, 'both')} aria-label={`Accept both for hunk ${idx + 1}`}>Accept both</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className='flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-800 pt-2'>
        <div className='text-xs text-neutral-600 dark:text-neutral-400'>
          {resolvedCount}/{totalFiles} files resolved
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='secondary'
            onClick={async () => {
              if (!window.confirm('Abort merge and discard in-progress resolution?')) return
              setAbortRunning(true)
              try {
                await gitService.resetAll(projectId)
                await recomputeResolvedAll()
                try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
              } finally {
                setAbortRunning(false)
              }
            }}
            disabled={abortRunning}
            loading={abortRunning}
          >
            Abort merge
          </Button>
          <div className='flex items-center gap-2'>
            <input type='text' value={finalizeMsg} onChange={(e) => setFinalizeMsg(e.target.value)} className='px-2 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-800 bg-transparent' placeholder={`Merge branch ${branch}`} />
            <label className='inline-flex items-center gap-1 text-xs'>
              <input type='checkbox' checked={pushImmediately} onChange={(e) => setPushImmediately(e.target.checked)} />
              <span>Push</span>
            </label>
            <Button onClick={async () => { await doFinalize() }} disabled={!allResolved || finalizing} loading={finalizing}>
              Continue (finalize merge)
            </Button>
          </div>
        </div>
      </div>

      {/* Concurrency prompt */}
      {externalChanged && (
        <div className='fixed bottom-3 left-1/2 -translate-x-1/2 z-20 bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-md shadow px-3 py-2 text-xs flex items-center gap-3'>
          <span>Files changed externally. Reload to pick up latest changes.</span>
          <Button size='xs' variant='secondary' onClick={async () => { await onRefresh(); setExternalChanged(false) }}>Reload</Button>
          <Button size='xs' variant='ghost' onClick={() => setExternalChanged(false)}>Dismiss</Button>
        </div>
      )}
    </div>
  )
}
