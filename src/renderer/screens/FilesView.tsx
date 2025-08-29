import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useFilesIndex from '../hooks/useFilesIndex';
import { FileMeta } from '../services/fileService';
import { MarkdownEditor } from '../components/files/MarkdownEditor';
import { BasicFileViewer } from '../components/files/BasicFileViewer';
import { goToFile, parseFileFromHash } from '../navigation/filesNavigation';

function isMarkdown(f: FileMeta) {
  return f.ext === 'md' || f.ext === 'mdx';
}

// Directory tree types built from file paths
interface DirNode {
  type: 'dir';
  name: string; // directory name only
  relPath: string; // '' for root or 'dir/subdir'
  dirs: DirNode[];
  files: FileMeta[];
}

function buildDirTree(files: FileMeta[]): DirNode {
  const root: DirNode = { type: 'dir', name: '', relPath: '', dirs: [], files: [] };
  const dirMap = new Map<string, DirNode>();
  dirMap.set('', root);

  function ensureDir(relPath: string): DirNode {
    const existing = dirMap.get(relPath);
    if (existing) return existing;
    const parts = relPath.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || '';
    const parentPath = parts.slice(0, -1).join('/');
    const parent = ensureDir(parentPath);
    const node: DirNode = { type: 'dir', name, relPath, dirs: [], files: [] };
    parent.dirs.push(node);
    dirMap.set(relPath, node);
    return node;
  }

  for (const f of files) {
    const path = f.path || f.name;
    const parts = path.split('/');
    const fileName = parts.pop() || f.name;
    const dirPath = parts.join('/');
    const dirNode = ensureDir(dirPath);
    // Normalize name
    const meta: FileMeta = { ...f, name: fileName };
    dirNode.files.push(meta);
  }

  // Sort directories and files
  const sortTree = (node: DirNode) => {
    node.dirs.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.dirs.forEach(sortTree);
  };
  sortTree(root);

  return root;
}

function Caret({ open }: { open: boolean }) {
  return (
    <span className="inline-block w-4 text-[10px] text-text-muted" aria-hidden>{open ? '▾' : '▸'}</span>
  );
}

function relTime(ms: number | undefined) {
  if (!ms) return '';
  const delta = Date.now() - ms;
  const sec = Math.round(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  return `${w}w ago`;
}

export const FilesView: React.FC = () => {
  const { files, loading, refresh } = useFilesIndex();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set([''])); // '' is root
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Sync selection with URL hash (#files/<path> or #documents/<path>)
  useEffect(() => {
    function syncFromHash() {
      const p = parseFileFromHash();
      setSelectedPath(p);
    }
    window.addEventListener('hashchange', syncFromHash);
    syncFromHash();
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  // Build tree from index
  const tree = useMemo(() => buildDirTree(files), [files]);

  // Expand the directory path of selected file
  useEffect(() => {
    if (!selectedPath) return;
    const parts = selectedPath.split('/');
    const dirParts = parts.slice(0, -1);
    if (dirParts.length === 0) return;
    const prefixes = dirParts.map((_, i) => dirParts.slice(0, i + 1).join('/'));
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.add('');
      prefixes.forEach((p) => next.add(p));
      return next;
    });
  }, [selectedPath]);

  const selectedFile = useMemo(() => {
    if (!files.length) return undefined;
    const sp = selectedPath;
    if (sp) return files.find((f) => f.path === sp) || undefined;
    return undefined;
  }, [files, selectedPath]);

  const handleToggleOpen = useCallback((dirRelPath: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(dirRelPath)) next.delete(dirRelPath); else next.add(dirRelPath);
      return next;
    });
  }, []);

  const filterMatch = useCallback((name: string, path: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return name.toLowerCase().includes(q) || path.toLowerCase().includes(q);
  }, [query]);

  function DirTree({ node, level = 0 }: { node: DirNode; level?: number }) {
    const isRoot = node.relPath === '';
    const isOpen = openSet.has(node.relPath) || isRoot;
    const indent = level * 14;

    // Apply filtering: if query present, only show matching dirs/files, and auto-open matches
    const q = query.trim();
    const childDirs = useMemo(() => {
      if (!q) return node.dirs;
      const result: DirNode[] = [];
      for (const d of node.dirs) {
        const filteredChild = filterDir(d, filterMatch);
        if (filteredChild) result.push(filteredChild);
      }
      return result;
    }, [node.dirs, q]);

    const childFiles = useMemo(() => {
      if (!q) return node.files;
      return node.files.filter((f) => filterMatch(f.name, f.path));
    }, [node.files, q]);

    return (
      <div>
        {!isRoot && (
          <div className="flex items-center py-1" style={{ paddingLeft: indent }}>
            <button
              type="button"
              onClick={() => handleToggleOpen(node.relPath)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-[color:var(--border-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
              aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
              title={isOpen ? 'Collapse' : 'Expand'}
            >
              <Caret open={isOpen} />
            </button>
            <button
              type="button"
              onClick={() => handleToggleOpen(node.relPath)}
              className="group flex items-center gap-2 rounded-md px-1 text-sm text-text-primary hover:bg-[color:var(--border-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
              title={node.name}
            >
              <span className="text-sm" aria-hidden>{isOpen ? '📂' : '📁'}</span>
              <span className="truncate font-medium text-text-primary">{node.name || 'root'}</span>
              <span className="ml-auto mr-2 rounded-full border border-border-subtle px-2 py-[1px] text-[10px] text-text-muted bg-[color:var(--surface-raised)]">{node.files.length}</span>
            </button>
          </div>
        )}
        {(isOpen || q) && (
          <div>
            {childDirs.map((d) => (
              <DirTree key={`dir:${d.relPath}`} node={d} level={level + 1} />
            ))}
            {childFiles.map((f) => {
              const isSel = selectedFile?.path === f.path;
              return (
                <button
                  key={`file:${f.path}`}
                  className={`group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm ${isSel ? 'bg-[color:var(--surface-raised)] border border-[color:var(--border-default)] shadow-[var(--shadow-1)]' : 'hover:bg-[color:var(--border-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]'}`}
                  onClick={() => goToFile(f.path)}
                  style={{ paddingLeft: (level * 14) + 28 }}
                  title={f.path}
                  aria-current={isSel ? 'true' : undefined}
                >
                  <span className="text-xs opacity-80 mt-[2px]" aria-hidden>📄</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-text-primary">{f.name}</div>
                    <div className="text-[10px] text-text-muted">{f.mtime ? `Updated ${relTime(f.mtime)}` : ''}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function filterDir(node: DirNode, match: (name: string, path: string) => boolean): DirNode | null {
    const filteredDirs: DirNode[] = [];
    for (const d of node.dirs) {
      const fd = filterDir(d, match);
      if (fd) filteredDirs.push(fd);
    }
    const filteredFiles = node.files.filter((f) => match(f.name, f.path));
    const selfMatches = match(node.name, node.relPath);
    if (selfMatches || filteredDirs.length > 0 || filteredFiles.length > 0) {
      return { ...node, dirs: filteredDirs, files: filteredFiles };
    }
    return null;
  }

  return (
    <div className="files-view" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100%' }}>
      <aside style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ flex: 1 }}>Files</strong>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search files"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ui-input"
            style={{ width: 160 }}
            aria-label="Search files"
          />
          <button className="btn btn--ghost" onClick={() => refresh()}>Refresh</button>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 12 }}>Loading index...</div>
          ) : files.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text-muted)' }}>No files found.</div>
          ) : (
            <div className="px-2 py-2">
              <DirTree node={query.trim() ? (filterDir(tree, filterMatch) || { ...tree, dirs: [], files: [] }) : tree} level={0} />
            </div>
          )}
        </div>
      </aside>
      <main style={{ minWidth: 0, minHeight: 0 }}>
        {!selectedFile ? (
          <div style={{ padding: 16, color: 'var(--text-muted)' }}>Select a file to view.</div>
        ) : isMarkdown(selectedFile) ? (
          <MarkdownEditor file={selectedFile} />
        ) : (
          <BasicFileViewer file={selectedFile} />
        )}
      </main>
    </div>
  );
};

export default FilesView;
