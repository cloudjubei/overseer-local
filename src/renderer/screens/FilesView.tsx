import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocsIndex } from '../hooks/useDocsIndex';
import { docsService } from '../services/docsService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import Skeleton, { SkeletonText } from '../components/ui/Skeleton';
import Tooltip from '../components/ui/Tooltip';
import MarkdownRenderer from '../components/MarkdownRenderer';
import MarkdownEditor from '../components/MarkdownEditor';
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar';

// Types from docs indexer (mirroring the browser view types for local use)
type DocHeading = { level: number; text: string };
type DocFileNode = {
  type: 'file';
  name: string;
  relPath: string;
  absPath: string;
  size: number;
  mtimeMs: number;
  title?: string | null;
  headings?: DocHeading[];
};
type DocDirNode = {
  type: 'dir';
  name: string;
  relPath: string; // '' for docs root
  absPath: string;
  dirs: DocDirNode[];
  files: DocFileNode[];
};

type SortBy = 'name' | 'recent' | 'size';

type VisibleEntry = { kind: 'file' | 'dir'; key: string; relPath: string; name: string; level: number };

// Utilities
function sortFiles(files: DocFileNode[], sortBy: SortBy) {
  const fs = [...files];
  if (sortBy === 'name') {
    fs.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
  } else if (sortBy === 'recent') {
    fs.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  } else if (sortBy === 'size') {
    fs.sort((a, b) => (b.size || 0) - (a.size || 0));
  }
  return fs;
}

function dSort(dirs: DocDirNode[]) {
  return [...dirs].sort((a, b) => a.name.localeCompare(b.name));
}

function filterTree(node: DocDirNode, query: string, sortBy: SortBy): DocDirNode | null {
  // If no query, just sort children
  const q = query.trim().toLowerCase();
  const matchFile = (f: DocFileNode) => {
    if (!q) return true;
    const name = (f.title || f.name || '').toLowerCase();
    return name.includes(q) || f.relPath.toLowerCase().includes(q);
  };
  const matchDir = (d: DocDirNode) => (!!(d.name || '').toLowerCase().includes(q));

  // Filter
  const subDirs = dSort(node.dirs).map((d) => filterTree(d, query, sortBy)).filter(Boolean) as DocDirNode[];
  const files = sortFiles(node.files.filter(matchFile), sortBy);

  if (!q) {
    return { ...node, dirs: subDirs, files };
  }

  // If query present, we include dir if: dir name matches, or any child matches
  const selfMatches = matchDir(node);
  const hasFileMatch = files.length > 0;
  const hasDirMatch = subDirs.length > 0;
  if (selfMatches || hasFileMatch || hasDirMatch) {
    return { ...node, dirs: subDirs, files };
  }
  return null;
}

function flattenVisibleFiles(node: DocDirNode, openSet: Set<string>, level = 0, acc: VisibleEntry[] = []): VisibleEntry[] {
  const isRoot = node.relPath === '';
  const key = isRoot ? '<root>' : node.relPath;
  const isOpen = openSet.has(key) || isRoot;

  // We only push directories (as entries) if not root
  if (!isRoot) {
    acc.push({ kind: 'dir', key: `dir:${node.relPath}`, relPath: node.relPath, name: node.name, level });
  }

  if (isOpen) {
    dSort(node.dirs).forEach((d) => flattenVisibleFiles(d, openSet, level + 1, acc));
    node.files.forEach((f) => {
      acc.push({ kind: 'file', key: `file:${f.relPath}`, relPath: f.relPath, name: f.title || f.name, level: level + 1 });
    });
  }
  return acc;
}

function findFileByRelPath(node: DocDirNode | null, relPath: string | null): DocFileNode | null {
  if (!node || !relPath) return null;
  if (node.files) {
    const f = node.files.find((x) => x.relPath === relPath);
    if (f) return f;
  }
  for (const d of node.dirs || []) {
    const found = findFileByRelPath(d, relPath);
    if (found) return found;
  }
  return null;
}

function useKeyShortcut(key: string, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === key) {
        // Avoid triggering when typing in an input/textarea or contenteditable
        const t = e.target as HTMLElement;
        const tag = (t?.tagName || '').toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || t?.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          handler();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, handler]);
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

export default function FilesView() {
  const { snapshot } = useDocsIndex();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [selected, setSelected] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(['<root>']));

  const searchRef = useRef<HTMLInputElement | null>(null);
  useKeyShortcut('/', () => searchRef.current?.focus());
  useKeyShortcut('ArrowDown', () => {
    const visibleFiles = visibleEntries.filter((e) => e.kind === 'file');
    if (visibleFiles.length === 0) return;
    if (!selected) {
      setSelected(visibleFiles[0].relPath);
      return;
    }
    const idx = visibleFiles.findIndex((e) => e.relPath === selected);
    const nextIdx = Math.min(visibleFiles.length - 1, idx + 1);
    if (nextIdx >= 0) setSelected(visibleFiles[nextIdx].relPath);
  });
  useKeyShortcut('ArrowUp', () => {
    const visibleFiles = visibleEntries.filter((e) => e.kind === 'file');
    if (visibleFiles.length === 0) return;
    if (!selected) {
      setSelected(visibleFiles[0].relPath);
      return;
    }
    const idx = visibleFiles.findIndex((e) => e.relPath === selected);
    const prevIdx = Math.max(0, idx - 1);
    if (prevIdx >= 0) setSelected(visibleFiles[prevIdx].relPath);
  });
  const editPaneRef = useRef<{ startEdit: () => void } | null>(null);
  useKeyShortcut('e', () => {
    if (selected && editPaneRef.current) editPaneRef.current.startEdit();
  });

  const root: DocDirNode | null = snapshot?.tree || null;
  const filteredTree = useMemo(() => root ? filterTree(root, query, sortBy) : null, [root, query, sortBy]);
  const visibleEntries = useMemo(() => filteredTree ? flattenVisibleFiles(filteredTree, openSet) : [], [filteredTree, openSet]);
  const selectedFile = useMemo(() => findFileByRelPath(root, selected), [root, selected]);

  const handleToggleOpen = useCallback((key: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!filteredTree) return;
    const gather = (n: DocDirNode, s: Set<string>) => {
      const k = n.relPath === '' ? '<root>' : n.relPath;
      s.add(k);
      n.dirs.forEach((d) => gather(d, s));
      return s;
    };
    setOpenSet(gather(filteredTree, new Set<string>()));
  }, [filteredTree]);

  const handleCollapseAll = useCallback(() => {
    setOpenSet(new Set(['<root>']));
  }, []);

  useEffect(() => {
    if (!selected || !root) return;
    const parts = selected.split('/');
    const prefixes = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'));
    setOpenSet((prev) => {
      const next = new Set(prev);
      next.add('<root>');
      prefixes.forEach((p) => next.add(p));
      return next;
    });
  }, [selected, root]);

  const totalFiles = snapshot?.files?.length ?? 0;
  const filteredFilesCount = useMemo(() => {
    if (!filteredTree) return 0;
    let count = 0;
    const walk = (n: DocDirNode) => {
      count += n.files.length;
      n.dirs.forEach(walk);
    };
    walk(filteredTree);
    return count;
  }, [filteredTree]);

  return (
    <CollapsibleSidebar
      items={[]}
      activeId=""
      onSelect={() => {}}
      storageKey="files-panel-collapsed"
      headerTitle="Files"
      headerSubtitle={`${filteredFilesCount || totalFiles} files${query ? ' • filtered' : ''}`}
      headerAction={
        <div className="flex items-center gap-2">
          <Input
            ref={searchRef}
            type="search"
            placeholder="Search files (/)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-48"
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="recent">Recently updated</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>
          <Tooltip content="Expand all">
            <Button variant="ghost" size="sm" onClick={handleExpandAll}>▾▾</Button>
          </Tooltip>
          <Tooltip content="Collapse all">
            <Button variant="ghost" size="sm" onClick={handleCollapseAll}>▸▸</Button>
          </Tooltip>
          <Tooltip content="Refresh index">
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>↳</Button>
          </Tooltip>
        </div>
      }
      sidebarClassName="w-80"
      navContent={
        <div className="px-2 py-2">
          {!root ? (
            <div className="p-3 text-sm text-text-muted">
              <Skeleton className="h-4 w-40" />
              <div className="mt-2">
                <SkeletonText lines={3} />
              </div>
            </div>
          ) : filteredTree ? (
            <DirTree
              node={filteredTree}
              level={0}
              openSet={openSet}
              toggleOpen={handleToggleOpen}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
            <EmptyState query={query} />
          )}
        </div>
      }
    >
      {!selected ? (
        <div className="h-full w-full grid place-items-center">
          <div className="text-center px-6 py-8">
            <div className="text-2xl mb-2">📄</div>
            <div className="text-sm text-text-secondary">Select a file from the list to view it.</div>
          </div>
        </div>
      ) : (
        <DocumentPane relPath={selected} file={selectedFile} ref={editPaneRef} />
      )}
    </CollapsibleSidebar>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="text-xl mb-2">🔍</div>
      <div className="text-sm text-text-secondary">No files match "{query}"</div>
      <div className="text-xs text-text-muted mt-1">Try a different search or clear filters.</div>
    </div>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <span className="inline-block w-4 text-[10px] text-text-muted" aria-hidden>{open ? '▾' : '▸'}</span>
  );
}

function DirTree({ node, level, openSet, toggleOpen, selected, onSelect }: {
  node: DocDirNode;
  level: number;
  openSet: Set<string>;
  toggleOpen: (relPath: string) => void;
  selected: string | null;
  onSelect: (relPath: string) => void;
}) {
  const isRoot = node.relPath === '';
  const key = isRoot ? '<root>' : node.relPath;
  const isOpen = openSet.has(key) || isRoot;
  const indent = level * 14;

  return (
    <div>
      <div className="flex items-center py-1" style={{ paddingLeft: indent }}>
        {!isRoot && (
          <button
            type="button"
            onClick={() => toggleOpen(key)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-[color:var(--border-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
            aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <Caret open={isOpen} />
          </button>
        )}
        <button
          type="button"
          onClick={() => !isRoot && toggleOpen(key)}
          className="group flex items-center gap-2 rounded-md px-1 text-sm text-text-primary hover:bg-[color:var(--border-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
          title={isRoot ? 'files' : node.name}
        >
          <span className="text-sm" aria-hidden>{isRoot ? '📚' : isOpen ? '📂' : '📁'}</span>
          <span className="truncate font-medium text-text-primary">{isRoot ? 'files' : node.name}</span>
          <span className="ml-auto mr-2 rounded-full border border-border-subtle px-2 py-[1px] text-[10px] text-text-muted bg-[color:var(--surface-raised)]">{node.files.length}</span>
        </button>
      </div>
      {isOpen && (
        <div>
          {dSort(node.dirs).map((d) => (
            <DirTree
              key={`dir:${d.relPath}`}
              node={d}
              level={level + 1}
              openSet={openSet}
              toggleOpen={toggleOpen}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
          {node.files.map((f) => {
            const isSel = selected === f.relPath;
            return (
              <button
                key={`file:${f.relPath}`}
                className={`group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm ${isSel ? 'bg-[color:var(--surface-raised)] border border-[color:var(--border-default)] shadow-[var(--shadow-1)]' : 'hover:bg-[color:var(--border-subtle)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]'}`}
                onClick={() => onSelect(f.relPath)}
                style={{ paddingLeft: (level * 14) + 28 }}
                title={f.relPath}
                aria-current={isSel ? 'true' : undefined}
              >
                <span className="text-xs opacity-80 mt-[2px]" aria-hidden>📄</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-text-primary">{f.title || f.name}</div>
                  <div className="text-[10px] text-text-muted">{f.mtimeMs ? `Updated ${relTime(f.mtimeMs)}` : ''}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type DocumentPaneHandle = { startEdit: () => void };

const DocumentPane = React.forwardRef<DocumentPaneHandle, { relPath: string; file: DocFileNode | null }>(function DocumentPane({ relPath, file }, ref) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    if (relPath){
      setLoading(true); setError(null);
      try {
        const text = await docsService.getFile(relPath);
        setContent(text || '');
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }
  }, [relPath]);

  useEffect(() => { load(); setIsEditing(false); setDraft(''); }, [relPath, load]);

  const onStartEdit = useCallback(() => { setDraft(content); setIsEditing(true); }, [content]);
  const onCancel = useCallback(() => { setIsEditing(false); setDraft(''); }, []);
  const onSave = useCallback(async (nextText: string) => {
    try {
      await docsService.saveFile(relPath, nextText);
      setContent(nextText);
      setIsEditing(false);
      setDraft('');
    } catch (e: any) {
      alert('Failed to save: ' + (e?.message || String(e)));
    }
  }, [relPath]);

  React.useImperativeHandle(ref, () => ({ startEdit: onStartEdit }), [onStartEdit]);

  const displayTitle = file?.title || file?.name || relPath?.split('/')?.pop() || relPath;
  const updated = file?.mtimeMs ? relTime(file.mtimeMs) : '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-base px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text-primary" title={relPath}>{displayTitle}</div>
          <div className="text-[11px] text-text-muted">{relPath}{updated ? ` • updated ${updated}` : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="primary" onClick={onStartEdit} aria-label="Edit file (E)">Edit</Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" onClick={() => onSave(draft)} aria-label="Save (Cmd/Ctrl+Enter)">Save</Button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 text-text-muted"><Spinner size={20} />Loading</div>
        )}
        {error && (
          <div className="text-[color:var(--color-red-600)]">{error}</div>
        )}
        {!loading && !error && !isEditing && relPath && (
          <div className="prose max-w-[840px] prose-invert:prose-dark">
            <MarkdownRenderer content={content} currentRelPath={relPath} onNavigateDoc={(p, fragment) => { /* navigation hook point */ }} />
          </div>
        )}
        {!loading && !error && isEditing && relPath && (
          <MarkdownEditor value={draft} onChange={setDraft} onSave={onSave} onCancel={onCancel} fileRelPath={relPath} />
        )}
      </div>
    </div>
  );
});
