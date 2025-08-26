import React, { useState, useCallback } from 'react';
import DocumentsBrowserView from '../docs/DocumentsBrowserView';

export default function DocumentsView() {
  const [selected, setSelected] = useState<string | null>(null);
  const handleSelect = useCallback((relPath: string) => setSelected(relPath), []);
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <DocumentsBrowserView onSelectFile={handleSelect} />
      </div>
    </div>
  );
}
