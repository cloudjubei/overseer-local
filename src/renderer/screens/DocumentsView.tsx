import React, { useState, useCallback } from 'react';
import DocumentsBrowserView from '../docs/DocumentsBrowserView';

export default function DocumentsView() {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = useCallback((relPath: string) => {
    setSelected(relPath);
  }, []);

  return (
    <div className="h-full w-full p-2">
      <DocumentsBrowserView onSelectFile={handleSelect} />
    </div>
  );
}
