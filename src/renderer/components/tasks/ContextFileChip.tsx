import React from 'react';
import FileDisplay from '../ui/FileDisplay';
import { inferFileType } from '../../../renderer/hooks/useFiles';

export default function ContextFileChip({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const file = React.useMemo(() => {
    const parts = path.split('/');
    const name = parts[parts.length - 1] || path;
    return { name, path, type: inferFileType(path) };
  }, [path]);

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md border bg-surface-raised border-border">
      <FileDisplay file={file} density="compact" showPreviewOnHover interactive />
      {onRemove && (
        <button type="button" className="btn-ghost text-xs" onClick={onRemove} title="Remove file">
          ✕
        </button>
      )}
    </div>
  );
}
