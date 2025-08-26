import React from 'react';

export type SpinnerProps = { size?: number; className?: string; label?: string };

export default function Spinner({ size = 16, className = '', label }: SpinnerProps) {
  const s = size;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <svg className="ui-spinner" width={s} height={s} viewBox="0 0 50 50" aria-hidden>
        <circle className="ui-spinner__track" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
        <circle className="ui-spinner__indicator" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
      </svg>
      {label ? <span className="text-sm text-[color:var(--text-muted)]">{label}</span> : null}
    </span>
  );
}
