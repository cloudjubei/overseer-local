import React from 'react';
import { Input } from './Input';
import FileDisplay from './FileDisplay';
import { useFiles, inferFileType } from '../../contexts/FilesContext';

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
  const { files } = useFiles();
  const [query, setQuery] = React.useState('');
  const [localSelected, setLocalSelected] = React.useState<string[]>(selected);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

  React.useEffect(() => {
    // Focus the search input when the selector opens
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, []);

  const filteredFiles = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? files.filter((p) => p.name.toLowerCase().includes(q))
      : files;
    return filtered.sort((a, b) => {
      if (q) {
        const aScore = a.name.toLowerCase().indexOf(q)
        const bScore = b.name.toLowerCase().indexOf(q)
        if (aScore !== bScore) return aScore - bScore;
      }
      return a.name.localeCompare(b.name);
    });
  }, [files, query]);

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
    <div className=\"file-selector flex flex-col gap-3\">\n      <div className=\"flex items-center justify-between gap-2\">\n        <div className=\"flex-1\">\n          <Input\n            ref={inputRef}\n            placeholder=\"Search files by name or path\"\n            value={query}\n            onChange={(e) => setQuery(e.target.value)}\n            aria-label=\"Search files\"\n          />\n        </div>\n        <div className=\"text-xs text-text-muted whitespace-nowrap pl-1\">\n          {filteredFiles.length} files\n        </div>\n      </div>\n
      <div role=\"listbox\" aria-label={title || 'Files'} className=\"border rounded-md max-h-[50vh] overflow-auto p-1 bg-surface-raised border-border\">\n        {filteredFiles.map((file) => {
          const selected = isSelected(file.path);
          return (
            <div key={file.path} role=\"option\" aria-selected={selected} className=\"flex items-center\">\n              <FileDisplay\n                file={file}\n                density=\"normal\"\n                interactive\n                showPreviewOnHover\n                onClick={() => toggle(file.path)}\n                trailing={\n                  <span\n                    className={\n                      'inline-flex items-center justify-center w-5 h-5 rounded-sm border text-[10px] ' +\n                      (selected\n                        ? 'bg-blue-600 text-white border-blue-600'\n                        : 'bg-transparent text-text-muted border-border')\n                    }\n                    aria-hidden\n                  >\n                    {selected ? '✓' : ''}\n                  </span>\n                }\n                className={selected ? 'bg-blue-50 dark:bg-blue-950/30' : ''}\n              />\n            </div>\n          );
        })}\n        {filteredFiles.length === 0 && (\n          <div className=\"p-4 text-sm text-text-muted\">No files match your search.</div>\n        )}\n      </div>\n\n      <div className=\"flex justify-end gap-2\">\n        {onCancel && (\n          <button type=\"button\" className=\"btn-secondary\" onClick={onCancel}>Cancel</button>\n        )}\n        <button type=\"button\" className=\"btn\" onClick={() => onConfirm(localSelected)} disabled={localSelected.length === 0 && allowMultiple}>\n          Confirm{localSelected.length ? ` (${localSelected.length})` : ''}\n        </button>\n      </div>\n    </div>\n  );
};
