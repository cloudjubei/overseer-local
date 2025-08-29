import React, { useMemo, useState } from 'react';
import useFilesIndex from '../hooks/useFilesIndex';
import { FileMeta } from '../services/filesService';
import { MarkdownEditor } from '../components/files/MarkdownEditor';
import { BasicFileViewer } from '../components/files/BasicFileViewer';

function isMarkdown(f: FileMeta) {
  return f.ext === 'md' || f.ext === 'mdx';
}

export const FilesView: React.FC = () => {
  const { files, loading, refresh } = useFilesIndex();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectedFile = useMemo(() => files.find(f => f.path === selectedPath) || files[0], [files, selectedPath]);

  return (
    <div className="files-view" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '100%' }}>
      <aside style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ flex: 1 }}>Files</strong>
          <button className="btn btn--ghost" onClick={() => refresh()}>Refresh</button>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 12 }}>Loading index...</div>
          ) : files.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text-muted)' }}>No files found.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => setSelectedPath(f.path)}
                    className="file-list-item"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', border: 'none', background: selectedFile?.path === f.path ? 'var(--bg-subtle)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left'
                    }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{f.ext ? '.' + f.ext : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
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
