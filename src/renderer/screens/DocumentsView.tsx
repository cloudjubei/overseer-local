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

function dSort(dirs: DocDirNode[]) {
  return [...dirs].sort((a, b) => a.name.localeCompare(b.name));
}

function useKeyShortcut(key: string, handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === key) {
        // Avoid triggering when typing in an input/textarea
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

export default function DocumentsView() {
  const { snapshot } = useDocsIndex();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [selected, setSelected] = useState<string | null>(null);
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(['<root>']));

  const searchRef = useRef<HTMLInputElement | null>(null);
  useKeyShortcut('/', () => searchRef.current?.focus());

  const root: DocDirNode | null = snapshot?.tree || null;
  const filteredTree = useMemo(() => {
    if (!root) return null;
    return filterTree(root, query, sortBy);
  }, [root, query, sortBy]);

  const handleToggleOpen = useCallback((key: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Ensure parents of selected are open
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="shrink-0 border-b border-border-subtle bg-surface-base">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <h1 className="m-0 truncate text-base font-semibold text-text-primary">Documents</h1>
            <div className="text-xs text-text-muted">{snapshot?.files?.length ?? 0} files</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Input
                ref={searchRef}
                type="search"
                placeholder="Search docs (/)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search documents"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger aria-label="Sort documents">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="recent">Recently updated</SelectItem>
                <SelectItem value="size">Size</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip content="Refresh index">
              <Button variant="secondary" size="md" onClick={() => window.location.reload()} aria-label="Refresh documents">
                ↻
              </Button>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 min-w-0">
        <div className="flex h-full min-h-0 w-full">
          <aside className="w-72 shrink-0 border-r border-border-subtle bg-surface-base/50 overflow-y-auto" aria-label="Documents folders">
            <div className="p-2">
              {!root ? (
                <div className="p-3 text-sm text-text-muted">
                  <Skeleton className="h-4 w-40" />
                  <div className="mt-2">
                    <SkeletonText lines={3} />
                  </div>
                </div>
              ) : (
                <DirTree
                  node={filteredTree || root}
                  level={0}
                  openSet={openSet}
                  toggleOpen={handleToggleOpen}
                  selected={selected}
                  onSelect={(p) => setSelected(p)}
                />
              )}
            </div>
          </aside>
          <section className="flex-1 min-w-0 min-h-0 overflow-hidden">
            {!selected ? (
              <div className="p-4 text-sm text-text-secondary">Select a document from the list to view it.</div>
            ) : (
              <DocumentPane relPath={selected} />
            )}
          </section>
        </div>
      </main>
    </div>
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
            className="inline-flex h-5 w-5 items-center justify-center rounded-md text-text-muted hover:bg-[color:var(--border-subtle)]"
            aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <span className="text-xs" aria-hidden>{isOpen ? '\u25be' : '\u25b8'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => !isRoot && toggleOpen(key)}
          className="flex items-center gap-2 rounded-md px-1 text-sm text-text-primary hover:bg-[color:var(--border-subtle)]"
          title={isRoot ? 'docs' : node.name}
        >
          <span className="text-sm" aria-hidden>{isRoot ? '\ud83d\udcda' : isOpen ? '\ud83d\udcc2' : '\ud83d\udcc1'}</span>
          <span className="truncate">{isRoot ? 'docs' : node.name}</span>
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
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${isSel ? 'bg-[color:var(--surface-raised)] border border-[color:var(--border-focus)]' : 'hover:bg-[color:var(--border-subtle)]'}`}
                onClick={() => onSelect(f.relPath)}
                style={{ paddingLeft: indent + 22 }}
                title={f.relPath}
              >
                <span className="text-xs opacity-80" aria-hidden>\ud83d\udcc4</span>
                <span className="truncate text-text-primary">{f.title || f.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocumentPane({ relPath }: { relPath: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const text = await docsService.getFile(relPath);
      setContent(text || '');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-base px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-text-muted" title={relPath}>{relPath}</div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="primary" onClick={onStartEdit}>Edit</Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onCancel}>Cancel</Button>
              <Button variant="primary" onClick={() => onSave(draft)}>Save</Button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3">
        {loading && (
          <div className="flex items-center gap-2 text-text-muted"><Spinner size={20} /> Loading…</div>
        )}
        {error && (
          <div className="text-[color:var(--color-red-600)]">{error}</div>
        )}
        {!loading && !error && !isEditing && (
          <MarkdownRenderer content={content} currentRelPath={relPath} onNavigateDoc={(p, fragment) => { /* navigation hook point */ }} />
        )}
        {!loading && !error && isEditing && (
          <MarkdownEditor value={draft} onChange={setDraft} onSave={onSave} onCancel={onCancel} fileRelPath={relPath} />
        )}
      </div>
    </div>
  );
}
