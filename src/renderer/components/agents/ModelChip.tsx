import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLLMConfig } from '../../hooks/useLLMConfig';
import { useNavigator } from '../../navigation/Navigator';

function providerLabel(p?: string) {
  if (!p) return '';
  const key = String(p).toLowerCase();
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
  };
  return map[key] || p;
}

function providerDotClasses(p?: string) {
  const key = String(p || '').toLowerCase();
  switch (key) {
    case 'openai':
      return 'bg-blue-500';
    case 'anthropic':
      return 'bg-orange-500';
    case 'gemini':
    case 'google':
      return 'bg-indigo-500';
    case 'xai':
      return 'bg-black';
    case 'groq':
      return 'bg-pink-500';
    case 'together':
      return 'bg-emerald-500';
    case 'azure':
      return 'bg-sky-600';
    case 'ollama':
    case 'local':
      return 'bg-neutral-500';
    case 'custom':
      return 'bg-purple-500';
    default:
      return 'bg-neutral-400';
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computePosition(
  anchor: HTMLElement,
  panel: HTMLElement | null,
  gap = 8
): { top: number; left: number; minWidth: number; side: 'top' | 'bottom' } {
  const ar = anchor.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const panelW = panel ? panel.offsetWidth : Math.max(160, ar.width);
  const panelH = panel ? panel.offsetHeight : 180;

  const spaceBelow = viewportH - ar.bottom;
  const side: 'top' | 'bottom' = spaceBelow < panelH + gap ? 'top' : 'bottom';

  let top: number;
  if (side === 'bottom') {
    top = ar.bottom + scrollY + gap;
  } else {
    top = ar.top + scrollY - panelH - gap;
  }

  let left = ar.left + scrollX;
  const padding = 8;
  const maxLeft = scrollX + viewportW - panelW - padding;
  const minLeft = scrollX + padding;
  left = clamp(left, minLeft, maxLeft);

  const minTop = scrollY + padding;
  const maxTop = scrollY + viewportH - panelH - padding;
  top = clamp(top, minTop, maxTop);

  return { top, left, minWidth: ar.width, side };
}

function useOutsideClick(refs: React.RefObject<HTMLElement>[], onOutside: () => void) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const inside = refs.some((r) => r.current && r.current.contains(t));
      if (!inside) onOutside();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [refs, onOutside]);
}

export type ModelChipProps = {
  provider?: string;
  model?: string;
  className?: string;
  editable?: boolean; // false by default
};

function Picker({ anchorEl, onClose }: { anchorEl: HTMLElement; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number; side: 'top' | 'bottom' } | null>(null);
  const { recentConfigs, activeConfigId, setActive } = useLLMConfig();
  const { navigateView } = useNavigator();
  const [activeIndex, setActiveIndex] = useState(0);

  useLayoutEffect(() => {
    const update = () => setCoords(computePosition(anchorEl, panelRef.current));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorEl]);

  useOutsideClick([panelRef], onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!panelRef.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(1, recentConfigs.length + 1));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + Math.max(1, recentConfigs.length + 1)) % Math.max(1, recentConfigs.length + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex < recentConfigs.length) {
          const cfg = recentConfigs[activeIndex];
          if (cfg) setActive(cfg.id);
          onClose();
        } else {
          navigateView('Settings');
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeIndex, onClose, recentConfigs, setActive]);

  if (!coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={`standard-picker standard-picker--${coords.side}`}
      role="menu"
      aria-label="Select LLM Configuration"
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(180, coords.minWidth + 8), position: 'absolute' }}
      onClick={(e) => { e.stopPropagation(); }}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
    >
      {recentConfigs.map((cfg, i) => {
        const isActive = cfg.id === activeConfigId;
        const dot = providerDotClasses(cfg.provider);
        return (
          <button
            key={cfg.id}
            role="menuitemradio"
            aria-checked={isActive}
            className="standard-picker__item"
            onClick={(e) => { e.stopPropagation(); setActive(cfg.id); onClose(); }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <span className={["inline-block w-1.5 h-1.5 rounded-full mr-2", dot].join(' ')} aria-hidden />
            <span className="standard-picker__label">{cfg.name} {cfg.model ? `(${cfg.model})` : ''}</span>
          </button>
        );
      })}
      <button
        role="menuitem"
        className="standard-picker__item"
        onClick={(e) => { e.stopPropagation(); navigateView('Settings'); onClose(); }}
        onMouseEnter={() => setActiveIndex(recentConfigs.length)}
      >
        <span className="standard-picker__label">Manage LLM Configurations…</span>
      </button>
    </div>,
    document.body
  );
}

export default function ModelChip({ provider, model, className, editable = false }: ModelChipProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const { configs, activeConfig } = useLLMConfig();
  const { navigateView } = useNavigator();

  // Determine display based on props or active config
  const prov = providerLabel(provider || activeConfig?.provider);
  const dot = providerDotClasses(provider || activeConfig?.provider);
  const displayModel = model || activeConfig?.model;
  const parts = [prov || undefined, displayModel || undefined].filter(Boolean);
  const label = parts.join(' · ');
  const title = label || (editable ? 'Select model' : 'Unknown model');

  // No configs case: mirror AgentModelQuickSelect behavior
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
    );
  }

  const chipEl = (
    <span
      ref={containerRef}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs',
        'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200',
        'border-neutral-200 dark:border-neutral-700',
        editable ? 'cursor-pointer hover:bg-neutral-100/80 dark:hover:bg-neutral-800' : '',
        'no-drag',
        className || '',
      ].join(' ')}
      title={title}
      aria-label={title}
      role={editable ? 'button' : 'note'}
      onClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        setOpen(true);
      }}
      onMouseDown={(e) => {
        if (!editable) return;
        // prevent accidental drag selection etc
        e.stopPropagation();
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
  );

  return (
    <>
      {chipEl}
      {editable && open && containerRef.current && (
        <Picker anchorEl={containerRef.current} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
