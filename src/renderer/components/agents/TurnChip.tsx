import React from 'react';

export default function TurnChip({ turn }: { turn: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-neutral-50 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" aria-hidden />
      <span>T{turn}</span>
    </span>
  );
}
