import React from 'react';

interface ChipProps {
  children: React.ReactNode;
  type: 'file' | 'reference';
}

export default function Chip({ children, type }: ChipProps) {
  const baseClasses = 'inline-block text-sm font-medium mx-0.5 px-2.5 py-1 rounded-full';
  const typeClasses = {
    file: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    reference: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  };

  return (
    <span
      className={`${baseClasses} ${typeClasses[type]}`}
      contentEditable={false}
      data-chip-type={type}
    >
      {children}
      <span contentEditable={false} style={{ display: 'inline-block', width: 0, height: 0 }} />
    </span>
  );
}
