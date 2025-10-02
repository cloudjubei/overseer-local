import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import type { LLMConfig } from 'thefactory-tools'

function providerLabel(p?: string) {
  if (!p) return ''
  const key = String(p).toLowerCase()
  const map: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini',
    google: 'Google',
    xai: 'xAI',
    groq: 'Groq',
    together: 'Together',
    azure: 'Azure',
    ollama: 'Ollama',
    local: 'Local',
    custom: 'Custom',
  }
  return map[key] || p
}

function providerDotClasses(p?: string) {
  const key = String(p || '').toLowerCase()
  switch (key) {
    case 'openai':
      return 'bg-blue-500'
    case 'anthropic':
      return 'bg-orange-500'
    case 'gemini':
    case 'google':
      return 'bg-indigo-500'
    case 'xai':
      return 'bg-black'
    case 'groq':
      return 'bg-pink-500'
    case 'together':
      return 'bg-emerald-500'
    case 'azure':
      return 'bg-sky-600'
    case 'ollama':
    case 'local':
      return 'bg-neutral-500'
    case 'custom':
      return 'bg-purple-500'
    default:
      return 'bg-neutral-400'
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function computePosition(
  anchor: HTMLElement,
  panel: HTMLElement | null,
  gap = 8,
): { top: number; left: number; minWidth: number; side: 'top' | 'bottom' } {
  const ar = anchor.getBoundingClientRect()
  const scrollX = window.scrollX || window.pageXOffset
  const scrollY = window.scrollY || window.pageYOffset
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  const panelW = panel ? panel.offsetWidth : Math.max(180, ar.width)
  const panelH = panel ? panel.offsetHeight : 180

  const spaceBelow = viewportH - ar.bottom
  const side: 'top' | 'bottom' = spaceBelow < panelH + gap ? 'top' : 'bottom'

  let top: number
  if (side === 'bottom') {
    top = ar.bottom + scrollY + gap
  } else {
    top = ar.top + scrollY - panelH - gap
  }

  const padding = 12 // A bit more padding

  let left: number
  // If aligning left would push it off-screen, align right instead.
  if (ar.left + panelW > viewportW - padding) {
    left = ar.right - panelW + scrollX
  } else {
    left = ar.left + scrollX
  }

  // Final clamping to ensure it's always on screen.
  const maxLeft = scrollX + viewportW - panelW - padding
  const minLeft = scrollX + padding
  left = clamp(left, minLeft, maxLeft)

  const minTop = scrollY + padding
  const maxTop = scrollY + viewportH - panelH - padding
  top = clamp(top, minTop, maxTop)

  return { top, left, minWidth: ar.width, side }
}

function useOutsideClick(refs: React.RefObject<HTMLElement | null>[], onOutside: () => void) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      const inside = refs.some((r) => r.current && r.current.contains(t))
      if (!inside) onOutside()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [refs, onOutside])
}

function Picker({
  anchorEl,
  onClose,
  selectedConfigId,
  onPickConfigId,
  recentConfigIds,
}: {
  anchorEl: HTMLElement
  onClose: () => void
  selectedConfigId?: string
  onPickConfigId: (configId: string) => void
  recentConfigIds: string[]
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    minWidth: number
    side: 'top' | 'bottom'
  } | null>(null)
  const { configs } = useLLMConfig()
  const { navigateView } = useNavigator()
  const [activeIndex, setActiveIndex] = useState(0)

  useLayoutEffect(() => {
    const update = () => setCoords(computePosition(anchorEl, panelRef.current))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorEl])

  useOutsideClick([panelRef], onClose)

  const recents: LLMConfig[] = React.useMemo(() => {
    if (recentConfigIds && recentConfigIds.length) {
      const map = new Map(configs.map((c) => [c.id, c] as const))
      return recentConfigIds.map((id) => map.get(id)).filter(Boolean) as LLMConfig[]
    }
    return []
  }, [recentConfigIds, configs])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!panelRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % Math.max(1, recents.length + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setActiveIndex(
          (i) => (i - 1 + Math.max(1, recents.length + 1)) % Math.max(1, recents.length + 1),
        )
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIndex < recents.length) {
          const cfg = recents[activeIndex]
          if (cfg) {
            onPickConfigId(cfg.id!)
          }
          onClose()
        } else {
          navigateView('Settings')
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeIndex, onClose, recents, onPickConfigId, navigateView])

  if (!coords) return null

  return createPortal(
    <div
      ref={panelRef}
      className={`standard-picker standard-picker--${coords.side}`}
      role="menu"
      aria-label="Select LLM Configuration"
      style={{
        top: coords.top,
        left: coords.left,
        minWidth: Math.max(180, coords.minWidth + 8),
        position: 'absolute',
      }}
      onClick={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
      }}
    >
      {recents.map((cfg, i) => {
        const isActive = cfg.id === selectedConfigId
        const dot = providerDotClasses(cfg.provider)
        return (
          <button
            key={cfg.id}
            role="menuitemradio"
            aria-checked={isActive}
            className="standard-picker__item"
            onClick={(e) => {
              e.stopPropagation()
              onPickConfigId(cfg.id!)
              onClose()
            }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <span
              className={['inline-block w-1.5 h-1.5 rounded-full mr-2', dot].join(' ')}
              aria-hidden
            />
            <span className="standard-picker__label">
              {cfg.name} {cfg.model ? `(${cfg.model})` : ''}
            </span>
          </button>
        )
      })}
      <button
        role="menuitem"
        className="standard-picker__item"
        onClick={(e) => {
          e.stopPropagation()
          navigateView('Settings')
          onClose()
        }}
        onMouseEnter={() => setActiveIndex(recents.length)}
      >
        <span className="standard-picker__label">Manage LLM Configurations…</span>
      </button>
    </div>,
    document.body,
  )
}

export type ModelChipProps = {
  provider?: string
  model?: string
  className?: string
  editable?: boolean // false by default
  mode?: 'agentRun' | 'chat'
}

export default function ModelChip({
  provider,
  model,
  className,
  editable = false,
  mode = 'agentRun',
}: ModelChipProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const {
    configs,
    activeAgentRunConfig,
    recentAgentRunConfigs,
    setActiveAgentRun,
    activeChatConfig,
    recentChatConfigs,
    setActiveChat,
  } = useLLMConfig()
  const { navigateView } = useNavigator()

  const setActiveId = useCallback(
    (id: string) => (mode === 'chat' ? setActiveChat(id) : setActiveAgentRun(id)),
    [mode, setActiveChat, setActiveAgentRun],
  )
  const activeConfig = useMemo(
    () => (mode === 'chat' ? activeChatConfig : activeAgentRunConfig),
    [mode, activeChatConfig, activeAgentRunConfig],
  )
  const recentConfigs = useMemo(
    () => (mode === 'chat' ? recentChatConfigs : recentAgentRunConfigs),
    [mode, recentAgentRunConfigs, recentChatConfigs],
  )

  let prov = providerLabel(provider)
  let displayModel = model

  if ((!prov || !displayModel) && activeConfig) {
    prov = providerLabel(activeConfig.provider)
    displayModel = activeConfig.model
  }

  const parts = [prov || undefined, displayModel || undefined].filter(Boolean)
  const label = parts.join(' · ')
  const title = label || (editable ? 'Select model' : 'Unknown model')

  if (editable && (!configs || configs.length === 0)) {
    return (
      <button
        type="button"
        className={`btn-secondary no-drag ${className || ''}`}
        onClick={() => navigateView('Settings')}
        title="No LLMs configured. Open Settings to add one."
        aria-label="Configure LLMs"
      >
        Configure LLM…
      </button>
    )
  }

  const chipEl = (
    <span
      ref={containerRef}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs',
        ' text-neutral-800  dark:text-neutral-200',
        mode === 'chat'
          ? 'bg-teal-500/20 border-teal-600 dark:border-teal-700  dark:bg-teal-800/60 '
          : 'bg-neutral-100 border-neutral-200 dark:border-neutral-700  dark:bg-neutral-800/60 ',
        editable ? 'cursor-pointer hover:bg-neutral-100/80 dark:hover:bg-neutral-800' : '',
        'no-drag',
        className || '',
      ].join(' ')}
      title={title}
      aria-label={title}
      role={editable ? 'button' : 'note'}
      onClick={(e) => {
        if (!editable) return
        e.stopPropagation()
        setOpen((o) => !o)
      }}
      onMouseDown={(e) => {
        if (!editable) return
        e.stopPropagation()
      }}
    >
      <span className="flex flex-col leading-tight max-w-[60px] items-center pr-1 pl-1 overflow-hidden text-ellipsis">
        <span className="truncate text-[10px] uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
          {prov || (editable ? 'Select' : '—')}
        </span>
        {(displayModel || editable) && (
          <span className="truncate text-xs font-medium">
            {displayModel || (editable ? 'model…' : '')}
          </span>
        )}
      </span>
    </span>
  )

  return (
    <>
      {chipEl}
      {editable && open && containerRef.current && (
        <Picker
          anchorEl={containerRef.current}
          onClose={() => setOpen(false)}
          selectedConfigId={activeConfig?.id}
          onPickConfigId={setActiveId}
          recentConfigIds={recentConfigs.map((c) => c.id).filter((c) => c !== undefined)}
        />
      )}
    </>
  )
}
