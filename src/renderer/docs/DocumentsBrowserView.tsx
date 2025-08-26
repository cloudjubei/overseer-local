import React, { useCallback, useEffect, useMemo, useState } from 'react';

// Types for the Docs Indexer snapshot
export type DocHeading = { level: number; text: string };
export type DocFileNode = {
  type: 'file';
  name: string;
  relPath: string;
  absPath: string;
  size: number;
  mtimeMs: number;
  title?: string | null;
  headings?: DocHeading[];
};
export type DocDirNode = {
  type: 'dir';
  name: string;
  relPath: string; // '' for docs root
  absPath: string;
  dirs: DocDirNode[];
  files: DocFileNode[];
};
export type DocsIndexSnapshot = {
  root: string;
  docsDir: string;
  updatedAt: string | null;
  tree: DocDirNode;
  files: DocFileNode[];
  errors: any[];
  metrics: { lastScanMs: number; lastScanCount: number };
};

// Preload bridge typing
declare global {
  interface Window {
    docsIndex: {
      get: () => Promise<DocsIndexSnapshot>;
      subscribe: (cb: (snapshot: DocsIndexSnapshot) => void) => () => void;
      getFile?: (relPath: string) => Promise<string>;
      saveFile?: (relPath: string, content: string) => Promise<any>;
    };
  }
}

export type DocumentsBrowserViewProps = {
  className?: string;
  onSelectFile?: (relPath: string) => void; // notify selection (content rendering handled later)
};

function useDocsIndex() {
  const [snapshot, setSnapshot] = useState<DocsIndexSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = (window as any).docsIndex;
      if (!api || typeof api.get !== 'function') {
        throw new Error('Docs IPC bridge is not available (window.docsIndex)');
      }
      const snap = await api.get();
      setSnapshot(snap);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsub: undefined | (() => void);
    load();
    try {
      const api = (window as any).docsIndex;
      if (api && typeof api.subscribe === 'function') {
        unsub = api.subscribe((snap: DocsIndexSnapshot) => {
          setSnapshot(snap);
        });
      }
    } catch {
      // ignore if subscribe is not available
    }
    return () => {
      if (unsub) try { unsub(); } catch {}
    };
  }, [load]);

  return { snapshot, loading, error, reload: load };
}

function sortDirs(dirs: DocDirNode[]) {
  return [...dirs].sort((a, b) => a.name.localeCompare(b.name));
}
function sortFiles(files: DocFileNode[]) {
  return [...files].sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
}

function DirItem({ node, level, openSet, toggleOpen, onSelectFile, selected }: {
  node: DocDirNode;
  level: number;
  openSet: Set<string>;
  toggleOpen: (relPath: string) => void;
  onSelectFile: (relPath: string) => void;
  selected: string | null;
}) {
  const isRoot = node.relPath === '';
  const key = isRoot ? '<root>' : node.relPath;
  const isOpen = openSet.has(key) || isRoot;

  const handleToggle = useCallback(() => {
    if (!isRoot) toggleOpen(key);
  }, [isRoot, key, toggleOpen]);

  const indentPx = Math.max(0, level) * 14; // visual indent per level

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-1 ${isRoot ? 'font-semibold' : ''}`}
        style={{ paddingLeft: indentPx }}
      >
        {!isRoot && (
          <button
            type="button"
            onClick={handleToggle}
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-800"
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <span className="text-xs">{isOpen ? '\u25be' : '\u25b8'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 rounded px-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title={isRoot ? 'docs' : node.name}
        >
          <span className="text-sm" aria-hidden>
            {isRoot ? '📚' : isOpen ? '📂' : '📁'}
          </span>
          <span className="text-neutral-800 dark:text-neutral-100">{isRoot ? 'docs' : node.name}</span>
        </button>
      </div>
      {isOpen && (
        <div>
          {sortDirs(node.dirs).map((d) => (
            <DirItem key={`dir:${d.relPath}`} node={d} level={level + 1} openSet={openSet} toggleOpen={toggleOpen} onSelectFile={onSelectFile} selected={selected} />
          ))}
          {sortFiles(node.files).map((f) => {
            const isSel = selected === f.relPath;
            return (
              <button
                key={`file:${f.relPath}`}
                type="button"
                onClick={() => onSelectFile(f.relPath)}
                className={`group flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${
                  isSel
                    ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-50'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50'
                }`}
                title={f.relPath}
                style={{ paddingLeft: indentPx + 22 }}
              >
                <span className="text-xs opacity-70" aria-hidden>📄</span>
                <span className="truncate">{f.title || f.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DocumentsBrowserView({ className, onSelectFile }: DocumentsBrowserViewProps) {
  const { snapshot, loading, error, reload } = useDocsIndex();
  const [selected, setSelected] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(['<root>']));

  // Keep selection if file still exists; otherwise clear
  useEffect(() => {
    if (!snapshot || !selected) return;
    const exists = snapshot.files?.some((f) => f.relPath === selected);
    if (!exists) setSelected(null);
  }, [snapshot, selected]);

  const toggleOpen = useCallback((relPath: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath); else next.add(relPath);
      return next;
    });
  }, []);

  const handleSelect = useCallback((relPath: string) => {
    setSelected(relPath);
    if (onSelectFile) onSelectFile(relPath);
  }, [onSelectFile]);

  const isEmpty = useMemo(() => {
    if (!snapshot) return false;
    const root = snapshot.tree;
    const hasFiles = (node: DocDirNode): boolean => {
      if (node.files && node.files.length > 0) return true;
      return node.dirs?.some(hasFiles) || false;
    };
    return !hasFiles(root);
  }, [snapshot]);

  return (
    <div className={`flex h-full min-h-[60vh] gap-4 ${className || ''}`}>
      <aside className="w-80 shrink-0 overflow-auto rounded border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Documents</div>
          <button
            type="button"
            onClick={reload}
            className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            title="Refresh"
          >
            Refresh
          </button>
        </div>
        {loading && (
          <div className="px-2 py-2 text-sm text-neutral-500 dark:text-neutral-400">Loading docs…</div>
        )}
        {error && (
          <div className="px-2 py-2 text-sm text-red-600 dark:text-red-400">
            Failed to load docs index: {error}
          </div>
        )}
        {snapshot && isEmpty && !loading && !error && (
          <div className="px-2 py-2 text-sm text-neutral-500 dark:text-neutral-400">
            No Markdown files found. Add .md files under the docs/ folder.
          </div>
        )}
        {snapshot && !isEmpty && (
          <div>
            <DirItem node={snapshot.tree} level={0} openSet={openSet} toggleOpen={toggleOpen} onSelectFile={handleSelect} selected={selected} />
          </div>
        )}
      </aside>
      <section className="min-w-0 flex-1 overflow-auto rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        {!selected && (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Select a document from the list to view it.</div>
        )}
        {selected && (
          <div className="space-y-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{selected}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-300">
              Preview will appear here in a later feature. For now, you have selected this Markdown file.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
