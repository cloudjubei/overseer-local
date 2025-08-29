import React from 'react';
import { Input } from './Input';
import FileDisplay from './FileDisplay';
import { useFilesIndex } from '../../hooks/useFilesIndex';
import { inferFileType } from '../../services/fileService';

export type FileSelectorProps = {
  selected?: string[]; // relPaths
  onConfirm: (selected: string[]) => void;
  onCancel?: () => void;
  allowMultiple?: boolean;
  title?: string;
};

function pathToMeta(path: string) {
  const parts = path.split('/')
  const name = parts[parts.length - 1] || path
  return {
    name,
    path,
    type: inferFileType(path),
  };
}

export const FileSelector: React.FC<FileSelectorProps> = ({ selected = [], onConfirm, onCancel, allowMultiple = true, title }) => {
  const { snapshot, filesList } = useFilesIndex();
  const [query, setQuery] = React.useState('');
  const [localSelected, setLocalSelected] = React.useState<string[]>(selected);

  React.useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

  const files = React.useMemo(() => {
    const list: string[] = Array.isArray(filesList) ? filesList : [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((p) => p.toLowerCase().includes(q))
      : list;
    // Basic sort: prioritize filename match, then alphabetical
    return filtered.sort((a, b) => {
      if (q) {
        const aName = a.split('/').pop() || a; const bName = b.split('/').pop() || b;
        const aScore = (aName?.toLowerCase().indexOf(q) ?? 9999);
        const bScore = (bName?.toLowerCase().indexOf(q) ?? 9999);
        if (aScore !== bScore) return aScore - bScore;
      }
      return a.localeCompare(b);
    });
  }, [filesList, query]);

  function toggle(path: string) {
    setLocalSelected((prev) => {
      const has = prev.includes(path);
      if (has) return prev.filter((p) => p !== path);
      if (!allowMultiple) return [path];
      return [...prev, path];
    });
  }

  function isSelected(path: string) {
    return localSelected.includes(path);
  }

  return (
    <div className="file-selector flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search files by name or path"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
          />
        </div>
        <div className="text-xs text-text-muted whitespace-nowrap pl-1">
          {files.length} files
        </div>
      </div>

      <div role="listbox" aria-label={title || 'Files'} className="border rounded-md max-h-[50vh] overflow-auto p-1 bg-surface-raised border-border">
        {files.map((path) => {
          const file = pathToMeta(path);
          const selected = isSelected(path);
          return (
            <div key={path} role="option" aria-selected={selected} className="flex items-center">
              <FileDisplay
                file={file}
                density="compact"
                interactive
                showPreviewOnHover
                onClick={() => toggle(path)}
                trailing={
                  <span
                    className={
                      'inline-flex items-center justify-center w-5 h-5 rounded-sm border text-[10px] ' +
                      (selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-transparent text-text-muted border-border')
                    }
                    aria-hidden
                  >
                    {selected ? '✓' : ''}
                  </span>
                }
                className={selected ? 'bg-blue-50 dark:bg-blue-950/30' : ''}
              />
            </div>
          );
        })}
        {files.length === 0 && (
          <div className="p-4 text-sm text-text-muted">No files match your search.</div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        )}
        <button type="button" className="btn" onClick={() => onConfirm(localSelected)} disabled={localSelected.length === 0 && allowMultiple}>
          Confirm{localSelected.length ? ` (${localSelected.length})` : ''}
        </button>
      </div>
    </div>
  );
};

export default FileSelector;
