import React from 'react';

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

export default function ModelChip({ provider, model, className }: { provider?: string; model?: string; className?: string }) {
  const dot = providerDotClasses(provider);
  const prov = providerLabel(provider);
  const parts = [prov || undefined, model || undefined].filter(Boolean);
  const label = parts.join(' · ');
  const title = label || 'Unknown model';

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200',
        'border-neutral-200 dark:border-neutral-700',
        className || '',
      ].join(' ')}
      title={title}
      aria-label={title}
      role="note"
    >
      <span className={["inline-block w-1.5 h-1.5 rounded-full", dot].join(' ')} aria-hidden />
      <span className="truncate max-w-[18ch]" style={{ lineHeight: 1 }}>{label || '—'}</span>
    </span>
  );
}
