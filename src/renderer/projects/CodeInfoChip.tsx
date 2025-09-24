import React from 'react';
import { renderLanguageIcon } from './codeInfoIcons';
import Tooltip from '../components/ui/Tooltip';
import { cn } from '../lib/utils';

interface CodeInfoChipProps {
  type: 'language' | 'framework' | 'testFramework';
  value: string;
  isInteractive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CodeInfoChip({ type, value, isInteractive, onClick, className }: CodeInfoChipProps) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-neutral-50 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700',
        isInteractive && 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700',
        className
      )}
      onClick={onClick}
    >
      {type === 'language' ? renderLanguageIcon(value as any, 'w-4 h-4') : value}
    </span>
  );

  if (type === 'language') {
    return (
      <Tooltip content={value} placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}
