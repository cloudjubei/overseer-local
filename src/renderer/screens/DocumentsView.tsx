import React from 'react';
import DocumentsBrowserView from '../docs/DocumentsBrowserView';

export default function DocumentsView()
{
  return (
    <div className="flex h-full flex-col gap-3">
      <header className="px-1">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Documentation</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Browse Markdown files under the docs/ directory.</p>
      </header>
      <DocumentsBrowserView />
    </div>
  );
};
